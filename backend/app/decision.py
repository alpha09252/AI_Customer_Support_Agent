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

RULE_NUMBERS: dict[str, str] = {
    "item_exists": "1",
    "return_window": "2",
    "final_sale": "3",
    "digital_product": "4",
    "order_status": "5",
    "refund_limit": "8",
    "category_window": "2a",
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


def _rule_number_int(rule_id: str) -> Optional[int]:
    num = RULE_NUMBERS.get(rule_id, "")
    try:
        return int(num)
    except ValueError:
        return None


def _build_reason(approved: bool, rules: list[dict], primary_reason: Optional[str]) -> str:
    if primary_reason:
        return primary_reason
    if approved:
        for r in rules:
            if r["rule_id"] == "return_window" and r["passed"]:
                return "Purchase within return window."
        return "All policy requirements met."
    return "Policy requirements not met."


def build_decision_json(approved: bool, rules: list[dict], confidence_pct: int, reason: str) -> dict:
    """Internal decision payload for admin dashboard and API consumers."""
    matched = sorted(
        n for r in rules if r["passed"] for n in [_rule_number_int(r["rule_id"])] if n is not None
    )
    return {
        "decision": "approve" if approved else "deny",
        "confidence": round(confidence_pct / 100, 2),
        "matched_rules": matched,
        "reason": reason,
    }


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

    confidence = _calc_confidence(checks, approved)
    reason = _build_reason(approved, rules, primary_reason)
    decision_json = build_decision_json(approved, rules, confidence, reason)

    return {
        "status": "approved" if approved else "denied",
        "reference": reference,
        "amount": amount,
        "item_name": item_name or (eligibility.get("item") or {}).get("name"),
        "order_id": eligibility.get("order_id"),
        "item_sku": (eligibility.get("item") or {}).get("sku"),
        "rules": rules,
        "confidence": confidence,
        "primary_reason": primary_reason,
        "decision_json": decision_json,
    }
