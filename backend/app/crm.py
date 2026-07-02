import json
from datetime import date
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).parent.parent / "data"

_crm_cache: Optional[dict] = None
_policy_cache: Optional[str] = None


def load_crm() -> dict:
    global _crm_cache
    if _crm_cache is None:
        with open(DATA_DIR / "crm_profiles.json") as f:
            _crm_cache = json.load(f)
    return _crm_cache


def load_policy() -> str:
    global _policy_cache
    if _policy_cache is None:
        with open(DATA_DIR / "refund_policy.md") as f:
            _policy_cache = f.read()
    return _policy_cache


def lookup_customer(email: Optional[str] = None, name: Optional[str] = None, order_id: Optional[str] = None) -> dict:
    """Look up a customer by email, name, or order ID."""
    crm = load_crm()
    for customer in crm["customers"]:
        if email and customer["email"].lower() == email.lower():
            return {"found": True, "customer": _summarize_customer(customer)}
        if name and name.lower() in customer["name"].lower():
            return {"found": True, "customer": _summarize_customer(customer)}
        if order_id:
            for order in customer["orders"]:
                if order["order_id"] == order_id:
                    return {"found": True, "customer": _summarize_customer(customer)}
    return {"found": False, "message": "No customer found matching the provided criteria."}


def get_order_details(order_id: str) -> dict:
    """Get full details for a specific order."""
    crm = load_crm()
    for customer in crm["customers"]:
        for order in customer["orders"]:
            if order["order_id"] == order_id:
                return {
                    "found": True,
                    "customer_id": customer["id"],
                    "customer_name": customer["name"],
                    "customer_email": customer["email"],
                    "customer_tier": customer["tier"],
                    "order": order,
                }
    return {"found": False, "message": f"Order {order_id} not found."}


def get_customer_refund_history(customer_id: str) -> dict:
    """Get a customer's refund history and limits."""
    crm = load_crm()
    for customer in crm["customers"]:
        if customer["id"] == customer_id:
            return {
                "found": True,
                "customer_id": customer_id,
                "customer_name": customer["name"],
                "refunds_this_year": customer["refunds_this_year"],
                "max_refunds_per_year": 3,
                "limit_reached": customer["refunds_this_year"] >= 3,
                "remaining_refunds": max(0, 3 - customer["refunds_this_year"]),
            }
    return {"found": False, "message": f"Customer {customer_id} not found."}


def check_refund_eligibility(
    order_id: str,
    item_sku: str,
    reason: str,
    reference_date: Optional[str] = None,
) -> dict:
    """Check if a specific item in an order is eligible for a refund per policy rules."""
    today = date.fromisoformat(reference_date) if reference_date else date(2024, 12, 20)

    order_result = get_order_details(order_id)
    if not order_result["found"]:
        return order_result

    customer_id = order_result["customer_id"]
    tier = order_result["customer_tier"]
    order = order_result["order"]

    refund_history = get_customer_refund_history(customer_id)
    checks = []
    eligible = True

    if order["status"] != "delivered":
        checks.append({"rule": "order_status", "passed": False, "detail": f"Order status is '{order['status']}', must be 'delivered'"})
        eligible = False
    else:
        checks.append({"rule": "order_status", "passed": True, "detail": "Order is delivered"})

    if refund_history["limit_reached"]:
        checks.append({"rule": "refund_limit", "passed": False, "detail": f"Customer has used all {refund_history['max_refunds_per_year']} refunds this year"})
        eligible = False
    else:
        checks.append({"rule": "refund_limit", "passed": True, "detail": f"{refund_history['remaining_refunds']} refund(s) remaining this year"})

    item = None
    for i in order["items"]:
        if i["sku"] == item_sku:
            item = i
            break

    if not item:
        checks.append({"rule": "item_exists", "passed": False, "detail": f"SKU {item_sku} not found in order {order_id}"})
        return {"eligible": False, "checks": checks, "item": None}

    checks.append({"rule": "item_exists", "passed": True, "detail": f"Item found: {item['name']}"})

    if item.get("final_sale", False):
        checks.append({"rule": "final_sale", "passed": False, "detail": "Item is marked as final sale — non-refundable"})
        eligible = False
    else:
        checks.append({"rule": "final_sale", "passed": True, "detail": "Item is not final sale"})

    category = item.get("category", "home")
    if category == "digital":
        checks.append({"rule": "digital_product", "passed": False, "detail": "Digital products are non-refundable"})
        eligible = False
    else:
        checks.append({"rule": "digital_product", "passed": True, "detail": "Not a digital product"})

    delivery_date = order.get("delivery_date")
    if delivery_date:
        delivery = date.fromisoformat(delivery_date)
        days_since = (today - delivery).days

        tier_windows = {"standard": 30, "gold": 45, "platinum": 60}
        window = tier_windows.get(tier, 30)

        if category == "electronics":
            window = 14
            checks.append({"rule": "category_window", "passed": None, "detail": "Electronics: 14-day window applies"})

        passed = days_since <= window
        checks.append({
            "rule": "return_window",
            "passed": passed,
            "detail": f"{days_since} days since delivery (window: {window} days for {tier} tier, category: {category})",
        })
        if not passed:
            eligible = False
    else:
        checks.append({"rule": "return_window", "passed": False, "detail": "No delivery date on record"})
        eligible = False

    return {
        "eligible": eligible,
        "order_id": order_id,
        "item": item,
        "customer_id": customer_id,
        "customer_tier": tier,
        "reason": reason,
        "checks": checks,
    }


def process_refund(order_id: str, item_sku: str, reason: str) -> dict:
    """Process an approved refund."""
    eligibility = check_refund_eligibility(order_id, item_sku, reason)
    if not eligibility.get("eligible"):
        return {
            "success": False,
            "message": "Refund cannot be processed — eligibility checks failed.",
            "checks": eligibility.get("checks", []),
        }

    ref_num = f"REF-2024-{order_id[-4:]}{item_sku[-2:]}"
    amount = eligibility["item"]["price"]

    return {
        "success": True,
        "refund_reference": ref_num,
        "amount": amount,
        "order_id": order_id,
        "item_sku": item_sku,
        "item_name": eligibility["item"]["name"],
        "message": f"Refund of ${amount:.2f} approved. Reference: {ref_num}. Processing in 5-7 business days.",
    }


def deny_refund(order_id: str, item_sku: str, reason: str, denial_reason: str) -> dict:
    """Deny a refund request with documented reason."""
    den_num = f"DEN-2024-{order_id[-4:]}{item_sku[-2:]}"
    return {
        "success": True,
        "denial_reference": den_num,
        "order_id": order_id,
        "item_sku": item_sku,
        "denial_reason": denial_reason,
        "customer_reason": reason,
        "message": f"Refund denied. Reference: {den_num}. Reason: {denial_reason}",
    }


def get_refund_policy() -> str:
    """Return the full refund policy document."""
    return load_policy()


def _summarize_customer(customer: dict) -> dict:
    return {
        "id": customer["id"],
        "name": customer["name"],
        "email": customer["email"],
        "tier": customer["tier"],
        "total_orders": customer["total_orders"],
        "refunds_this_year": customer["refunds_this_year"],
        "orders": [
            {"order_id": o["order_id"], "date": o["date"], "total": o["total"], "status": o["status"]}
            for o in customer["orders"]
        ],
    }
