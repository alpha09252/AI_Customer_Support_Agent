"""Customer-facing streaming step labels for the chat UI."""

import asyncio
from collections.abc import Awaitable, Callable

_emitters: dict[str, Callable[[str], Awaitable[None]]] = {}

# Internal timeline label → customer-facing stream text
CHAT_STREAM_LABELS: dict[str, str] = {
    "Looking up customer...": "Looking up your account...",
    "Looking up order...": "Checking your order...",
    "Checking refund history...": "Checking your purchase history...",
    "Loading refund policy...": "Reading refund policy...",
    "Evaluating policy rules...": "Evaluating eligibility...",
    "Processing refund...": "Processing your refund...",
    "Escalating to manual review...": "Flagging for specialist review...",
}

STREAM_DELAY_SEC = 0.45


def register_emitter(session_id: str, emitter: Callable[[str], Awaitable[None]]) -> None:
    _emitters[session_id] = emitter


def unregister_emitter(session_id: str) -> None:
    _emitters.pop(session_id, None)


async def emit_chat_step(session_id: str, label: str, status: str = "pending", decision_status: str = "") -> None:
    """Emit a customer-facing streaming step to the chat UI."""
    emitter = _emitters.get(session_id)
    if not emitter:
        return

    if status == "decision" and decision_status:
        text = f"{decision_status}."
    elif status == "pending" and label in CHAT_STREAM_LABELS:
        text = CHAT_STREAM_LABELS[label]
    else:
        return

    await emitter(text)
    await asyncio.sleep(STREAM_DELAY_SEC)
