"""Manual review queue — escalate uncertain cases instead of auto-deny."""

import uuid
from datetime import datetime
from typing import Optional

from app.decision import POLICY_RULE_LABELS, RULE_NUMBERS, _calc_confidence
from app.websocket import log_broadcaster

_queue: list[dict] = []
_ticket_counter = 1452

# Rules that are always auto-denied — never escalated
_HARD_DENY_RULES = {"digital_product", "final_sale", "refund_limit", "item_exists"}


def _next_ticket() -> str:
    global _ticket_counter
    num = _ticket_counter
    _ticket_counter += 1
    return f"#{num}"


def assess_manual_review(
    eligibility: dict,
    *,
    customer_tier: str = "standard",
    refunds_this_year: int = 0,
    amount: Optional[float] = None,
    customer_name: str = "",
) -> Optional[dict]:
    """
    Return escalation info when the agent should not auto-approve/deny.
    Returns None when the case is clear-cut.
    """
    checks = eligibility.get("checks", [])
    failed_keys = {c["rule"] for c in checks if c.get("passed") is False}
    eligible = eligibility.get("eligible", False)
    tags: list[str] = []
    reasons: list[str] = []

    if failed_keys & _HARD_DENY_RULES:
        return None

    if customer_tier in ("platinum", "gold"):
        tags.append("VIP Customer")

    if refunds_this_year >= 2:
        tags.append("Possible Fraud")
        reasons.append(f"Customer has {refunds_this_year} refunds this year — abuse check needed")

    if refunds_this_year >= 2 and eligible:
        return {"tags": list(dict.fromkeys(tags)), "reason": "; ".join(reasons)}

    if amount and amount > 500:
        tags.append("High Value")
        reasons.append(f"Refund amount ${amount:.2f} exceeds $500 auto-approval threshold")

    if eligible and (amount or 0) > 500:
        if not reasons:
            reasons.append("High-value refund requires manager sign-off per policy §8")
        return {"tags": tags or ["High Value"], "reason": "; ".join(reasons)}

    if eligible and customer_tier == "platinum" and refunds_this_year == 0 and (amount or 0) > 200:
        tags.append("VIP Customer")
        reasons.append("Platinum customer — expedited review recommended")
        return {"tags": list(dict.fromkeys(tags)), "reason": "; ".join(reasons)}

    if not eligible and failed_keys == {"return_window"}:
        reasons.append("Return window borderline — agent confidence too low to auto-deny")
        return {"tags": tags or ["Borderline Case"], "reason": "; ".join(reasons)}

    if not eligible and failed_keys == {"order_status"}:
        return None

    if not eligible and len(failed_keys) == 1 and "return_window" in failed_keys:
        return {"tags": tags or ["Borderline Case"], "reason": reasons[0] if reasons else "Borderline return window case"}

    confidence = _calc_confidence(checks, eligible)
    if not eligible and 75 <= confidence <= 88 and tags:
        reasons.append("Mixed signals — policy checks inconclusive")
        return {"tags": tags, "reason": "; ".join(reasons)}

    return None


def build_manual_review_decision(
    eligibility: dict,
    *,
    escalation: dict,
    reference: Optional[str] = None,
    amount: Optional[float] = None,
    item_name: Optional[str] = None,
    customer_name: str = "",
    customer_tier: str = "standard",
) -> dict:
    checks = eligibility.get("checks", [])
    rules = []
    for check in checks:
        if check.get("passed") is None:
            continue
        key = check.get("rule", "")
        rules.append({
            "rule_id": key,
            "label": POLICY_RULE_LABELS.get(key, key),
            "passed": bool(check["passed"]),
            "detail": check.get("detail", ""),
        })

    confidence = min(84, _calc_confidence(checks, eligibility.get("eligible", False)))
    reason = escalation.get("reason", "Requires human review")
    ticket = _next_ticket()

    matched = []
    for r in rules:
        if r["passed"]:
            num = RULE_NUMBERS.get(r["rule_id"], "")
            if num.isdigit():
                matched.append(int(num))
    decision_json = {
        "decision": "manual_review",
        "confidence": round(confidence / 100, 2),
        "matched_rules": matched,
        "reason": reason,
        "ticket": ticket,
        "tags": escalation.get("tags", []),
    }

    return {
        "status": "manual_review",
        "reference": reference or ticket,
        "amount": amount,
        "item_name": item_name or (eligibility.get("item") or {}).get("name"),
        "order_id": eligibility.get("order_id"),
        "item_sku": (eligibility.get("item") or {}).get("sku"),
        "rules": rules,
        "confidence": confidence,
        "primary_reason": reason,
        "decision_json": decision_json,
        "ticket": ticket,
        "tags": escalation.get("tags", []),
        "customer_name": customer_name,
        "customer_tier": customer_tier,
    }


def get_pending_reviews() -> list[dict]:
    return [q for q in _queue if q.get("status") == "pending"]


def reset_manual_reviews() -> None:
    """Clear the manual review queue and reset ticket numbering."""
    global _ticket_counter
    _queue.clear()
    _ticket_counter = 1452


def enqueue_review(session_id: str, decision: dict) -> dict:
    entry = {
        "ticket": decision.get("ticket", _next_ticket()),
        "session_id": session_id,
        "order_id": decision.get("order_id", "—"),
        "customer_name": decision.get("customer_name", "Unknown"),
        "customer_tier": decision.get("customer_tier", "standard"),
        "tags": decision.get("tags", []),
        "reason": decision.get("primary_reason", ""),
        "confidence": decision.get("confidence", 0),
        "amount": decision.get("amount"),
        "item_name": decision.get("item_name"),
        "status": "pending",
        "created_at": datetime.now().strftime("%H:%M:%S"),
    }
    _queue.insert(0, entry)
    return entry


async def enqueue_and_broadcast(session_id: str, decision: dict) -> dict:
    entry = enqueue_review(session_id, decision)
    await log_broadcaster.broadcast(
        "manual_review_queued",
        {"review": entry, "pending_count": len(get_pending_reviews())},
        session_id,
    )
    return entry


def seed_pending_reviews() -> None:
    global _ticket_counter
    if _queue:
        return
    _queue.extend([
        {
            "ticket": "#1452",
            "session_id": "seed",
            "order_id": "ORD-2024-8841",
            "customer_name": "Sarah Mitchell",
            "customer_tier": "gold",
            "tags": ["VIP Customer", "High Value"],
            "reason": "Refund over $500 — manager review recommended",
            "confidence": 82,
            "amount": 249.99,
            "item_name": "Wireless Noise-Canceling Headphones",
            "status": "pending",
            "created_at": "14:14:55",
        },
        {
            "ticket": "#1453",
            "session_id": "seed",
            "order_id": "ORD-2024-7711",
            "customer_name": "Maria Garcia",
            "customer_tier": "standard",
            "tags": ["Possible Fraud"],
            "reason": "Customer has 2 refunds this year — abuse check needed",
            "confidence": 79,
            "amount": 189.99,
            "item_name": "Winter Parka - Waterproof",
            "status": "pending",
            "created_at": "14:22:10",
        },
    ])
    _ticket_counter = 1454
