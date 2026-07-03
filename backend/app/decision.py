"""Build structured refund decision payloads for the chat UI."""

from typing import Optional

# Maps internal check keys → policy rule labels shown to customers
POLICY_RULE_LABELS: dict[str, str] = {
    "item_exists": "Rule 1: Item SKU verified in order",
    "return_window": "Rule 2: Purchase within return window",
    "final_sale": "Rule 3: Not a final sale item",
    "digital_product": "Rule 4: Not a digital product",
    "order_status": "Rule 5: Item delivered",
    "refund_limit": "Rule 8: Refund history acceptable",
    "category_window": "Rule 2a: Category-specific window applies",
}


def _calc_confidence(checks: list[dict], approved: bool) -> int:
    decisive = [c for c in checks if c.get("passed") is not None]
    if not decisive:
        return 85
    passed = sum(1 for c in decisive if c["passed"])
    total = len(decisive)
    if approved and passed == total:
        return min(99, 94 + total)
    if not approved:
        failed = total - passed
        return min(99, 88 + failed * 5)
    return int((passed / total) * 100)


def build_decision(
    eligibility: dict,
    *,
    approved: bool,
    reference: Optional[str] = None,
    amount: Optional[float] = None,
    item_name: Optional[str] = None,
    primary_reason: Optional[str] = None,
) -> dict:
    checks = eligibility.get("checks", [])
    rules = []
    for check in checks:
        if check.get("passed") is None:
            continue
        key = check.get("rule", "")
        rules.append({
            "rule_id": key,
            "label": POLICY_RULE_LABELS.get(key, key.replace("_", " ").title()),
            "passed": bool(check["passed"]),
            "detail": check.get("detail", ""),
        })

    failed = [r for r in rules if not r["passed"]]
    if not primary_reason and failed:
        primary_reason = failed[0]["detail"]

    return {
        "status": "approved" if approved else "denied",
        "reference": reference,
        "amount": amount,
        "item_name": item_name or (eligibility.get("item") or {}).get("name"),
        "order_id": eligibility.get("order_id"),
        "item_sku": (eligibility.get("item") or {}).get("sku"),
        "rules": rules,
        "confidence": _calc_confidence(checks, approved),
        "primary_reason": primary_reason,
    }
