import re
from typing import Optional

from app.crm import (
    lookup_customer,
    get_order_details,
    get_customer_refund_history,
    check_refund_eligibility,
    process_refund,
    deny_refund,
)
from app.decision import build_decision
from app.manual_review import assess_manual_review, build_manual_review_decision, enqueue_and_broadcast
from app.timeline import timeline, timeline_start, timeline_decision, timeline_from_eligibility


def _extract_email(text: str) -> str | None:
    match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", text)
    return match.group(0) if match else None


def _extract_order_id(text: str) -> str | None:
    match = re.search(r"ORD-\d{4}-\d{4}", text, re.IGNORECASE)
    return match.group(0).upper() if match else None


def _extract_sku(text: str) -> str | None:
    match = re.search(r"\b(?:ELEC|CLTH|HOME|DIGI)-\d{4}\b", text, re.IGNORECASE)
    return match.group(0).upper() if match else None


def _gather_context(message: str, history: list[dict]) -> tuple[str | None, str | None, str | None]:
    """Collect email, order ID, and SKU from the full conversation (multi-turn flow)."""
    email: str | None = None
    order_id: str | None = None
    sku: str | None = None

    texts = [msg.get("content", "") for msg in history if msg.get("role") == "user"]
    texts.append(message)

    for text in texts:
        if found := _extract_email(text):
            email = found
        if found := _extract_order_id(text):
            order_id = found
        if found := _extract_sku(text):
            sku = found

    return email, order_id, sku


async def run_demo_agent(message: str, history: list[dict], session_id: str) -> tuple[str, Optional[dict]]:
    """Rule-based agent that calls CRM tools and returns a structured decision."""
    await timeline_start(session_id, "Customer requested refund")
    await timeline(session_id, "Customer requested refund", "success", message[:120])

    email, order_id, sku = _gather_context(message, history)

    if not email and not order_id:
        response = (
            "I'd be happy to help with your refund request. "
            "Could you please provide your email address or order ID so I can look up your account?"
        )
        await timeline(session_id, "Awaiting customer details", "pending", "Need email or order ID")
        return response, None

    await timeline(session_id, "Looking up customer...", "pending")
    customer_result = lookup_customer(email=email, order_id=order_id)

    if not customer_result.get("found"):
        await timeline(session_id, "Customer not found", "failed", "No matching CRM record")
        return "I couldn't find an account matching that information. Please double-check your email or order ID.", None

    customer = customer_result["customer"]
    name = customer["name"]
    await timeline(session_id, "Customer found", "success", name)

    if not order_id:
        orders = ", ".join(o["order_id"] for o in customer["orders"])
        await timeline(session_id, "Awaiting order details", "pending", orders)
        return (
            f"Hi {name}, I found your account. Your recent orders are: {orders}. "
            "Which order would you like a refund for, and which item (SKU)?"
        ), None

    await timeline(session_id, "Looking up order...", "pending", order_id)
    order_result = get_order_details(order_id)

    if not order_result.get("found"):
        await timeline(session_id, "Order not found", "failed", order_id)
        return f"Hi {name}, I found your account but order {order_id} wasn't found. Please verify the order number.", None

    await timeline(session_id, "Order found", "success", f"{order_id} — {order_result['order']['status']}")

    if not sku:
        items = ", ".join(i["sku"] for i in order_result["order"]["items"])
        await timeline(session_id, "Awaiting item SKU", "pending", items)
        return f"Hi {name}, I found order {order_id}. Which item would you like to refund? Available items: {items}", None

    customer_id = order_result["customer_id"]
    await timeline(session_id, "Checking refund history...", "pending")
    refund_history = get_customer_refund_history(customer_id)
    if refund_history.get("limit_reached"):
        await timeline(session_id, "Refund history", "failed", "Annual limit of 3 refunds reached")
    else:
        remaining = refund_history.get("remaining_refunds", 0)
        await timeline(session_id, "Refund history acceptable", "success", f"{remaining} refund(s) remaining this year")

    reason = "Customer requested refund"
    await timeline(session_id, "Evaluating policy rules...", "pending")
    eligibility = check_refund_eligibility(order_id, sku, reason)
    await timeline_from_eligibility(session_id, eligibility)

    item = eligibility.get("item") or {}
    amount = item.get("price", 0)
    tier = order_result.get("customer_tier", customer.get("tier", "standard"))
    refunds_ytd = refund_history.get("refunds_this_year", customer.get("refunds_this_year", 0))

    escalation = assess_manual_review(
        eligibility,
        customer_tier=tier,
        refunds_this_year=refunds_ytd,
        amount=amount,
        customer_name=name,
    )

    if escalation:
        await timeline(session_id, "Escalating to manual review...", "pending")
        decision = build_manual_review_decision(
            eligibility,
            escalation=escalation,
            amount=amount,
            item_name=item.get("name"),
            customer_name=name,
            customer_tier=tier,
        )
        await enqueue_and_broadcast(session_id, decision)
        await timeline_decision(
            session_id, "Needs Manual Review", decision["confidence"], escalation["reason"],
            decision["decision_json"], decision,
        )
        response = (
            f"Hi {name}, I've reviewed your refund request for **{item.get('name', 'your item')}**. "
            f"This case requires additional review by our team (ref **{decision['ticket']}**). "
            "A specialist will follow up within 24 hours."
        )
        return response, decision

    if eligibility.get("eligible"):
        await timeline(session_id, "Processing refund...", "pending")
        result = process_refund(order_id, sku, reason)
        decision = build_decision(
            eligibility,
            approved=True,
            reference=result["refund_reference"],
            amount=result["amount"],
            item_name=result["item_name"],
        )
        await timeline_decision(
            session_id, "Approved", decision["confidence"], result["refund_reference"],
            decision["decision_json"], decision,
        )
        response = (
            f"Hi {name}, I've reviewed your refund request for **{result['item_name']}**. "
            "See the decision details below."
        )
    else:
        failed = [c for c in eligibility.get("checks", []) if c.get("passed") is False]
        denial_reason = failed[0]["detail"] if failed else "Policy requirements not met"
        result = deny_refund(order_id, sku, reason, denial_reason)
        decision = build_decision(
            eligibility,
            approved=False,
            reference=result["denial_reference"],
            primary_reason=denial_reason,
        )
        await timeline_decision(
            session_id, "Denied", decision["confidence"], denial_reason,
            decision["decision_json"], decision,
        )
        response = (
            f"Hi {name}, I've reviewed your refund request. "
            "Unfortunately it cannot be approved — see the decision details below."
        )

    return response, decision
