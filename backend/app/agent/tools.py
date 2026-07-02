from langchain_core.tools import tool
from app.crm import (
    lookup_customer,
    get_order_details,
    get_customer_refund_history,
    check_refund_eligibility,
    process_refund,
    deny_refund,
    get_refund_policy,
)


@tool
def tool_lookup_customer(email: str = "", name: str = "", order_id: str = "") -> str:
    """Look up a customer in the CRM by email, name, or order ID. At least one parameter is required."""
    result = lookup_customer(
        email=email or None,
        name=name or None,
        order_id=order_id or None,
    )
    return str(result)


@tool
def tool_get_order_details(order_id: str) -> str:
    """Get full details for a specific order including items, status, and delivery date."""
    return str(get_order_details(order_id))


@tool
def tool_get_refund_history(customer_id: str) -> str:
    """Get a customer's refund history and check if they've reached the annual refund limit."""
    return str(get_customer_refund_history(customer_id))


@tool
def tool_check_refund_eligibility(order_id: str, item_sku: str, reason: str) -> str:
    """Check if a specific item in an order is eligible for a refund according to policy rules.
    Returns detailed pass/fail for each policy check."""
    return str(check_refund_eligibility(order_id, item_sku, reason))


@tool
def tool_process_refund(order_id: str, item_sku: str, reason: str) -> str:
    """Process an approved refund. Only call after eligibility checks pass."""
    return str(process_refund(order_id, item_sku, reason))


@tool
def tool_deny_refund(order_id: str, item_sku: str, reason: str, denial_reason: str) -> str:
    """Deny a refund request with a documented policy-based reason."""
    return str(deny_refund(order_id, item_sku, reason, denial_reason))


@tool
def tool_get_refund_policy() -> str:
    """Retrieve the full refund policy document. Use this to understand all rules before making decisions."""
    return get_refund_policy()


ALL_TOOLS = [
    tool_lookup_customer,
    tool_get_order_details,
    tool_get_refund_history,
    tool_check_refund_eligibility,
    tool_process_refund,
    tool_deny_refund,
    tool_get_refund_policy,
]
