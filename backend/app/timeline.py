"""Human-readable timeline events for the admin dashboard."""

from app.decision import POLICY_RULE_LABELS, RULE_NUMBERS
from app.stream import emit_chat_step
from app.websocket import log_broadcaster


async def timeline(session_id: str, label: str, status: str = "success", detail: str = "") -> None:
    """Emit a single timeline step. status: pending | success | failed | decision"""
    await log_broadcaster.broadcast(
        "timeline",
        {"label": label, "status": status, "detail": detail},
        session_id,
    )
    await emit_chat_step(session_id, label, status)


async def timeline_start(session_id: str, message: str) -> None:
    await log_broadcaster.broadcast(
        "timeline_start",
        {"message": message[:200]},
        session_id,
    )


async def timeline_decision(
    session_id: str,
    status: str,
    confidence: int,
    detail: str = "",
    decision_json: dict | None = None,
    decision: dict | None = None,
) -> None:
    await log_broadcaster.broadcast(
        "timeline",
        {
            "label": "Decision",
            "status": "decision",
            "detail": detail,
            "decision_status": status,
            "confidence": confidence,
        },
        session_id,
    )
    if decision_json:
        await log_broadcaster.broadcast("decision_json", decision_json, session_id)
    if decision:
        from app.history import record_and_broadcast
        await record_and_broadcast(session_id, decision)
    await emit_chat_step(session_id, "Decision", "decision", decision_status=status)


async def broadcast_policy_rules(session_id: str, eligibility: dict) -> None:
    """Emit policy_rule events for the Policy Rule Viewer panel."""
    for check in eligibility.get("checks", []):
        if check.get("passed") is None:
            continue
        key = check.get("rule", "")
        num = RULE_NUMBERS.get(key, "?")
        label = POLICY_RULE_LABELS.get(key, key.replace("_", " ").title())
        short = label.split(": ", 1)[-1] if ": " in label else label
        await log_broadcaster.broadcast(
            "policy_rule",
            {
                "number": num,
                "label": short,
                "passed": bool(check["passed"]),
                "detail": check.get("detail", ""),
            },
            session_id,
        )
    await log_broadcaster.broadcast(
        "policy_rules_complete",
        {"eligible": eligibility.get("eligible", False)},
        session_id,
    )


async def timeline_from_eligibility(session_id: str, eligibility: dict) -> None:
    """Emit per-rule timeline steps and policy rule viewer updates."""
    await timeline(session_id, "Loading refund policy...", "pending")
    for check in eligibility.get("checks", []):
        if check.get("passed") is None:
            continue
        key = check.get("rule", "")
        num = RULE_NUMBERS.get(key, "?")
        label = POLICY_RULE_LABELS.get(key, key.replace("_", " ").title())
        short = label.split(": ", 1)[-1] if ": " in label else label
        passed = bool(check["passed"])

        await log_broadcaster.broadcast(
            "policy_rule",
            {"number": num, "label": short, "passed": passed, "detail": check.get("detail", "")},
            session_id,
        )
        await timeline(
            session_id,
            f"Applying Rule #{num}",
            "success" if passed else "failed",
            short,
        )

    await log_broadcaster.broadcast(
        "policy_rules_complete",
        {"eligible": eligibility.get("eligible", False)},
        session_id,
    )
