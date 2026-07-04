"""In-memory request history and dashboard stats."""

import uuid
from datetime import date, datetime
from typing import Optional

from app.websocket import log_broadcaster

_records: list[dict] = []
_seeded = False


def _today() -> str:
    return date.today().isoformat()


def _classify_manual(decision: dict) -> bool:
    if decision.get("status") == "manual_review":
        return True
    amount = decision.get("amount") or 0
    confidence = decision.get("confidence", 0)
    if decision.get("status") == "approved" and amount > 500:
        return True
    return confidence < 85


def record_request(session_id: str, decision: dict) -> dict:
    djson = decision.get("decision_json") or {}
    now = datetime.now()

    status = decision.get("status", "")
    decision_label = {
        "approved": "Approved",
        "denied": "Denied",
        "manual_review": "Manual Review",
    }.get(status, "Unknown")

    record = {
        "id": str(uuid.uuid4())[:8],
        "session_id": session_id,
        "order_id": decision.get("order_id") or "—",
        "decision": decision_label,
        "status": status,
        "reason": djson.get("reason") or decision.get("primary_reason") or "—",
        "time": now.strftime("%H:%M:%S"),
        "date": _today(),
        "confidence": decision.get("confidence", 0),
        "manual_review": status == "manual_review" or _classify_manual(decision),
        "ticket": decision.get("ticket"),
        "item_name": decision.get("item_name"),
        "item_sku": decision.get("item_sku"),
        "amount": decision.get("amount"),
        "reference": decision.get("reference"),
        "tags": decision.get("tags") or [],
        "rules": decision.get("rules") or [],
        "decision_json": djson or None,
    }
    _records.insert(0, record)
    if len(_records) > 100:
        _records.pop()
    return record


def get_stats() -> dict:
    from app.manual_review import get_pending_reviews

    today_records = [r for r in _records if r.get("date") == _today()]
    approved = sum(1 for r in today_records if r["decision"] == "Approved")
    denied = sum(1 for r in today_records if r["decision"] == "Denied")
    manual = len(get_pending_reviews())
    return {
        "today_requests": len(today_records),
        "approved": approved,
        "denied": denied,
        "manual_review": manual,
    }


def get_history(limit: int = 50) -> list[dict]:
    return _records[:limit]


def get_record(record_id: str) -> Optional[dict]:
    for record in _records:
        if record.get("id") == record_id:
            return record
    return None


def get_order_history(order_id: str, limit: int = 20) -> list[dict]:
    if not order_id or order_id == "—":
        return []
    return [r for r in _records if r.get("order_id") == order_id][:limit]


def reset_history() -> None:
    """Clear all request history (demo seed and live records)."""
    global _seeded
    _records.clear()
    _seeded = False


async def record_and_broadcast(session_id: str, decision: dict) -> None:
    record = record_request(session_id, decision)
    await log_broadcaster.broadcast(
        "history_update",
        {"record": record, "stats": get_stats()},
        session_id,
    )


def seed_demo_history() -> None:
    global _seeded
    if _seeded or _records:
        return
    _seeded = True

    samples = [
        ("ORD-2024-9102", "Approved", "Purchase within return window.", "08:12:04", 99, False),
        ("ORD-2024-9933", "Approved", "All policy requirements met.", "08:28:17", 97, False),
        ("ORD-2024-8877", "Approved", "Purchase within return window.", "08:44:33", 98, False),
        ("ORD-2024-9966", "Approved", "All policy requirements met.", "09:01:22", 97, False),
        ("ORD-2024-6655", "Approved", "Purchase within return window.", "09:18:45", 99, False),
        ("ORD-2024-7711", "Approved", "All policy requirements met.", "09:35:10", 96, False),
        ("ORD-2024-8841", "Approved", "Purchase within return window.", "09:52:28", 98, False),
        ("ORD-2024-6688", "Approved", "All policy requirements met.", "10:08:51", 97, False),
        ("ORD-2024-9102", "Approved", "Purchase within return window.", "10:25:14", 99, False),
        ("ORD-2024-9933", "Approved", "All policy requirements met.", "10:41:39", 98, False),
        ("ORD-2024-7788", "Approved", "Purchase within return window.", "10:58:02", 88, False),
        ("ORD-2024-5566", "Approved", "All policy requirements met.", "11:14:27", 97, False),
        ("ORD-2024-9955", "Approved", "Purchase within return window.", "11:30:55", 96, False),
        ("ORD-2024-6612", "Approved", "All policy requirements met.", "11:47:18", 98, False),
        ("ORD-2024-7723", "Approved", "Purchase within return window.", "12:03:41", 97, False),
        ("ORD-2024-8899", "Approved", "All policy requirements met.", "12:20:06", 99, False),
        ("ORD-2024-9922", "Approved", "Purchase within return window.", "12:36:33", 96, False),
        ("ORD-2024-5544", "Approved", "All policy requirements met.", "12:52:58", 98, False),
        ("ORD-2024-7723", "Denied", "Customer has used all 3 refunds this year", "13:09:14", 93, False),
        ("ORD-2024-6612", "Denied", "Item is marked as final sale — non-refundable", "13:25:37", 96, False),
        ("ORD-2024-8899", "Denied", "Digital products are non-refundable", "13:42:02", 95, False),
        ("ORD-2024-9922", "Denied", "Order status is 'shipped', must be 'delivered'", "13:58:29", 94, False),
        ("ORD-2024-8841", "Manual Review", "Refund over $500 — manager review recommended", "14:14:55", 82, True),
    ]
    today = _today()
    for order_id, decision, reason, time_str, confidence, manual in samples:
        _records.append({
            "id": str(uuid.uuid4())[:8],
            "session_id": "seed",
            "order_id": order_id,
            "decision": decision,
            "reason": reason,
            "time": time_str,
            "date": today,
            "confidence": confidence,
            "manual_review": manual,
        })
