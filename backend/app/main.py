import os
import uuid
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agent.graph import run_agent
from app.agent.demo import run_demo_agent
from app.websocket import log_broadcaster
from app.crm import load_crm

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
            if decision:
                await log_broadcaster.broadcast("decision", decision, session_id)
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


@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    await log_broadcaster.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        log_broadcaster.disconnect(websocket)
