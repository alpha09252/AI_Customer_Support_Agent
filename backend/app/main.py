import asyncio
import json
import os
import uuid
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agent.graph import run_agent
from app.agent.demo import run_demo_agent
from app.stream import register_emitter, unregister_emitter
from app.websocket import log_broadcaster
from app.crm import load_crm
from app.decision import POLICY_RULE_LABELS, RULE_NUMBERS

from app.history import get_stats, get_history, get_record, get_order_history, reset_history
from app.manual_review import get_pending_reviews, reset_manual_reviews, resolve_review

load_dotenv()

DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("1", "true", "yes")  # set true if OpenAI unavailable

app = FastAPI(title="ShopEase AI Support Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: str = ""
    history: list[dict] = []


class ResolveReviewRequest(BaseModel):
    action: str  # approve | deny
    notes: str = ""


class PolicyRule(BaseModel):
    rule_id: str
    label: str
    passed: bool
    detail: str


class Decision(BaseModel):
    status: str
    reference: str | None = None
    amount: float | None = None
    item_name: str | None = None
    order_id: str | None = None
    item_sku: str | None = None
    rules: list[PolicyRule] = []
    confidence: int = 0
    primary_reason: str | None = None
    decision_json: dict | None = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    decision: Decision | None = None


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "ai-support-agent",
        "demo_mode": DEMO_MODE,
    }


@app.get("/api/policy")
async def get_policy():
    rules = []
    for key, label in POLICY_RULE_LABELS.items():
        num = RULE_NUMBERS.get(key, "?")
        short = label.split(": ", 1)[-1] if ": " in label else label
        rules.append({"number": num, "label": short, "rule_id": key})
    rules.sort(key=lambda r: (len(r["number"]), r["number"]))
    return {"title": "Refund Policy", "version": "2.1", "rules": rules}


@app.get("/api/dashboard/stats")
async def dashboard_stats():
    return get_stats()


@app.get("/api/dashboard/manual-review")
async def dashboard_manual_review():
    return get_pending_reviews()


@app.post("/api/dashboard/manual-review/{ticket}/resolve")
async def resolve_manual_review(ticket: str, req: ResolveReviewRequest):
    try:
        result = await resolve_review(ticket, req.action, req.notes)
        return {"ok": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e).lower() else 400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve review: {e}")


@app.get("/api/dashboard/history")
async def dashboard_history():
    return get_history()


@app.get("/api/dashboard/history/{record_id}")
async def dashboard_history_detail(record_id: str):
    record = get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Request not found")

    order_id = record.get("order_id", "")
    related = get_order_history(order_id)
    order_info = None
    customer_info = None

    if order_id and order_id != "—":
        from app.crm import get_order_details
        order_result = get_order_details(order_id)
        if order_result.get("found"):
            order = order_result["order"]
            order_info = {
                "order_id": order_id,
                "status": order.get("status"),
                "date": order.get("date"),
                "delivery_date": order.get("delivery_date"),
                "total": order.get("total"),
                "items": order.get("items", []),
            }
            customer_info = {
                "customer_id": order_result.get("customer_id"),
                "name": order_result.get("customer_name"),
                "tier": order_result.get("customer_tier"),
            }

    return {
        "record": record,
        "related": related,
        "order": order_info,
        "customer": customer_info,
    }


@app.post("/api/dashboard/reset")
async def dashboard_reset():
    """Clear all admin dashboard data (history, stats, manual review queue)."""
    reset_history()
    reset_manual_reviews()
    stats = get_stats()
    await log_broadcaster.broadcast(
        "dashboard_reset",
        {
            "stats": stats,
            "history": [],
            "reviews": [],
        },
        "",
    )
    return {"ok": True, "stats": stats}


@app.get("/api/customers")
async def list_customers():
    crm = load_crm()
    return [
        {
            "id": c["id"],
            "name": c["name"],
            "email": c["email"],
            "tier": c["tier"],
            "orders": len(c["orders"]),
        }
        for c in crm["customers"]
    ]


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())
    try:
        if DEMO_MODE:
            response, decision = await run_demo_agent(req.message, req.history, session_id)
        else:
            response, decision = await run_agent(req.message, req.history, session_id)
        return ChatResponse(response=response, session_id=session_id, decision=decision)
    except Exception as e:
        error_msg = str(e)
        if "unsupported_country_region_territory" in error_msg:
            raise HTTPException(
                status_code=503,
                detail="OpenAI API is not available in your region. Set DEMO_MODE=true in backend/.env to test without OpenAI.",
            )
        if "OPENAI_API_KEY" in error_msg:
            raise HTTPException(status_code=503, detail="OpenAI API key is missing. Set OPENAI_API_KEY or DEMO_MODE=true in backend/.env.")
        raise HTTPException(status_code=500, detail=f"Agent error: {error_msg}")


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()

    async def emitter(text: str) -> None:
        await queue.put({"type": "step", "text": text})

    async def run_agent_task() -> None:
        try:
            register_emitter(session_id, emitter)
            if DEMO_MODE:
                response, decision = await run_demo_agent(req.message, req.history, session_id)
            else:
                response, decision = await run_agent(req.message, req.history, session_id)
            await queue.put({
                "type": "done",
                "response": response,
                "decision": decision,
                "session_id": session_id,
            })
        except Exception as e:
            error_msg = str(e)
            if "unsupported_country_region_territory" in error_msg:
                detail = "OpenAI API is not available in your region. Set DEMO_MODE=true in backend/.env."
            elif "OPENAI_API_KEY" in error_msg:
                detail = "OpenAI API key is missing."
            else:
                detail = f"Agent error: {error_msg}"
            await queue.put({"type": "error", "detail": detail})
        finally:
            unregister_emitter(session_id)
            await queue.put(None)

    asyncio.create_task(run_agent_task())

    async def event_generator():
        while True:
            item = await queue.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    await log_broadcaster.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        log_broadcaster.disconnect(websocket)
