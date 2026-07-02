import re
from app.crm import (
    lookup_customer,
    get_order_details,
    get_customer_refund_history,
    check_refund_eligibility,
    process_refund,
    deny_refund,
)
from app.websocket import log_broadcaster


def _extract_email(text: str) -> str | None:
    match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", text)
    return match.group(0) if match else None


def _extract_order_id(text: str) -> str | None:
    match = re.search(r"ORD-\d{4}-\d{4}", text, re.IGNORECASE)
    return match.group(0).upper() if match else None


def _extract_sku(text: str) -> str | None:
    match = re.search(r"\b(?:ELEC|CLTH|HOME|DIGI)-\d{4}\b", text, re.IGNORECASE)
    return match.group(0).upper() if match else None


async def _log(event_type: str, data: dict, session_id: str):
    await log_broadcaster.broadcast(event_type, data, session_id)


async def run_demo_agent(message: str, history: list[dict], session_id: str) -> str:
    """Rule-based agent that calls the same CRM tools without OpenAI."""
    await _log("user_message", {"content": message}, session_id)
    await _log("reasoning", {"content": "[Demo Mode] Parsing customer request and running policy tools locally.", "role": "agent"}, session_id)

    email = _extract_email(message)
    order_id = _extract_order_id(message)
    sku = _extract_sku(message)

    if not email and not order_id:
        response = (
            "I'd be happy to help with your refund request. "
            "Could you please provide your email address or order ID so I can look up your account?"
        )
        await _log("reasoning", {"content": response, "role": "agent"}, session_id)
        return response

    await _log("tool_call", {"tool": "tool_lookup_customer", "args": {"email": email or "", "order_id": order_id or ""}}, session_id)
    customer_result = lookup_customer(email=email, order_id=order_id)
    await _log("tool_result", {"tool": "tool_lookup_customer", "result": str(customer_result)[:500]}, session_id)

    if not customer_result.get("found"):
        response = "I couldn't find an account matching that information. Please double-check your email or order ID."
        await _log("reasoning", {"content": response, "role": "agent"}, session_id)
        return response

    customer = customer_result["customer"]
    name = customer["name"]

    if not order_id:
        orders = ", ".join(o["order_id"] for o in customer["orders"])
        response = f"Hi {name}, I found your account. Your recent orders are: {orders}. Which order would you like a refund for, and which item (SKU)?"
        await _log("reasoning", {"content": response, "role": "agent"}, session_id)
        return response

    await _log("tool_call", {"tool": "tool_get_order_details", "args": {"order_id": order_id}}, session_id)
    order_result = get_order_details(order_id)
    await _log("tool_result", {"tool": "tool_get_order_details", "result": str(order_result)[:500]}, session_id)

    if not order_result.get("found"):
        response = f"Hi {name}, I found your account but order {order_id} wasn't found. Please verify the order number."
        await _log("reasoning", {"content": response, "role": "agent"}, session_id)
        return response

    if not sku:
        items = ", ".join(f"{i['sku']} ({i['name']})" for i in order_result["order"]["items"])
        response = f"Hi {name}, I found order {order_id}. Which item would you like to refund? Available items: {items}"
        await _log("reasoning", {"content": response, "role": "agent"}, session_id)
        return response

    customer_id = order_result["customer_id"]
    await _log("tool_call", {"tool": "tool_get_refund_history", "args": {"customer_id": customer_id}}, session_id)
    refund_history = get_customer_refund_history(customer_id)
    await _log("tool_result", {"tool": "tool_get_refund_history", "result": str(refund_history)[:500]}, session_id)

    reason = "Customer requested refund"
    await _log("tool_call", {"tool": "tool_check_refund_eligibility", "args": {"order_id": order_id, "item_sku": sku, "reason": reason}}, session_id)
    eligibility = check_refund_eligibility(order_id, sku, reason)
    await _log("tool_result", {"tool": "tool_check_refund_eligibility", "result": str(eligibility)[:500]}, session_id)

    if eligibility.get("eligible"):
        await _log("tool_call", {"tool": "tool_process_refund", "args": {"order_id": order_id, "item_sku": sku, "reason": reason}}, session_id)
        result = process_refund(order_id, sku, reason)
        await _log("tool_result", {"tool": "tool_process_refund", "result": str(result)[:500]}, session_id)
        response = (
            f"Hi {name}, good news! Your refund request has been approved.\n\n"
            f"**Item:** {result['item_name']}\n"
            f"**Amount:** ${result['amount']:.2f}\n"
            f"**Reference:** {result['refund_reference']}\n\n"
            f"The refund will be processed to your original payment method within 5-7 business days."
        )
    else:
        failed = [c for c in eligibility.get("checks", []) if c.get("passed") is False]
        denial_reason = failed[0]["detail"] if failed else "Policy requirements not met"
        await _log("tool_call", {"tool": "tool_deny_refund", "args": {"order_id": order_id, "item_sku": sku, "reason": reason, "denial_reason": denial_reason}}, session_id)
        result = deny_refund(order_id, sku, reason, denial_reason)
        await _log("tool_result", {"tool": "tool_deny_refund", "result": str(result)[:500]}, session_id)
        checks_text = "\n".join(f"- {c['rule']}: {c['detail']}" for c in eligibility.get("checks", []))
        response = (
            f"Hi {name}, I'm sorry but your refund request cannot be approved.\n\n"
            f"**Reference:** {result['denial_reference']}\n"
            f"**Reason:** {denial_reason}\n\n"
            f"Policy checks:\n{checks_text}"
        )

    await _log("reasoning", {"content": response, "role": "agent"}, session_id)
    return response
