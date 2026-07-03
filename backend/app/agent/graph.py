import ast
import os
from typing import Annotated, Optional, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.agent.tools import ALL_TOOLS
from app.agent.prompts import SYSTEM_PROMPT
from app.decision import build_decision, POLICY_RULE_LABELS
from app.timeline import timeline, timeline_start, timeline_decision, broadcast_policy_rules

TOOL_PENDING_LABELS: dict[str, str] = {
    "tool_lookup_customer": "Looking up customer...",
    "tool_get_order_details": "Looking up order...",
    "tool_get_refund_history": "Checking refund history...",
    "tool_get_refund_policy": "Loading refund policy...",
    "tool_check_refund_eligibility": "Evaluating policy rules...",
    "tool_process_refund": "Processing refund...",
    "tool_deny_refund": "Recording denial...",
}


def _describe_tool_result(tool_name: str, parsed: dict) -> list[tuple[str, str, str]]:
    """Returns list of (label, status, detail) tuples."""
    steps: list[tuple[str, str, str]] = []

    if tool_name == "tool_lookup_customer":
        if parsed.get("found"):
            name = parsed.get("customer", {}).get("name", "Unknown")
            steps.append(("Customer found", "success", name))
        else:
            steps.append(("Customer not found", "failed", parsed.get("message", "")))

    elif tool_name == "tool_get_order_details":
        if parsed.get("found"):
            order = parsed.get("order", {})
            steps.append(("Order found", "success", f"{order.get('order_id', '')} — {order.get('status', '')}"))
        else:
            steps.append(("Order not found", "failed", parsed.get("message", "")))

    elif tool_name == "tool_get_refund_history":
        if parsed.get("limit_reached"):
            steps.append(("Refund history", "failed", "Annual limit of 3 refunds reached"))
        elif parsed.get("found"):
            rem = parsed.get("remaining_refunds", 0)
            steps.append(("Refund history acceptable", "success", f"{rem} refund(s) remaining"))

    elif tool_name == "tool_get_refund_policy":
        steps.append(("Refund policy loaded", "success", "ShopEase Policy v2.1"))

    elif tool_name == "tool_check_refund_eligibility":
        if parsed.get("checks"):
            for check in parsed["checks"]:
                if check.get("passed") is None:
                    continue
                key = check.get("rule", "")
                label = POLICY_RULE_LABELS.get(key, key)
                num = label.split(":")[0].replace("Rule ", "#") if label.startswith("Rule") else key
                short = label.split(": ", 1)[-1] if ": " in label else label
                status = "success" if check["passed"] else "failed"
                steps.append((f"Applying {num}", status, short))

    elif tool_name == "tool_process_refund":
        if parsed.get("success"):
            steps.append(("Refund processed", "success", parsed.get("refund_reference", "")))

    elif tool_name == "tool_deny_refund":
        if parsed.get("success"):
            steps.append(("Denial recorded", "success", parsed.get("denial_reference", "")))

    return steps


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    session_id: str


def create_agent():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is required")

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3, api_key=api_key)
    llm_with_tools = llm.bind_tools(ALL_TOOLS)
    tool_node = ToolNode(ALL_TOOLS)

    async def call_model(state: AgentState):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
        response = await llm_with_tools.ainvoke(messages)
        session_id = state.get("session_id", "")

        if response.tool_calls:
            for tc in response.tool_calls:
                pending = TOOL_PENDING_LABELS.get(tc["name"], f"Running {tc['name']}...")
                await timeline(session_id, pending, "pending")

        return {"messages": [response]}

    async def run_tools(state: AgentState):
        result = await tool_node.ainvoke(state)
        session_id = state.get("session_id", "")

        for msg in result.get("messages", []):
            if not isinstance(msg, ToolMessage):
                continue
            parsed = _parse_tool_result(msg.content)
            if not isinstance(parsed, dict):
                continue
            if msg.name == "tool_check_refund_eligibility" and parsed.get("checks"):
                await broadcast_policy_rules(session_id, parsed)
            for label, status, detail in _describe_tool_result(msg.name or "", parsed):
                await timeline(session_id, label, status, detail)

        return result

    def should_continue(state: AgentState):
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(AgentState)
    graph.add_node("agent", call_model)
    graph.add_node("tools", run_tools)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


_agent = None


def get_agent():
    global _agent
    if _agent is None:
        _agent = create_agent()
    return _agent


async def run_agent(message: str, history: list[dict], session_id: str) -> tuple[str, Optional[dict]]:
    agent = get_agent()

    messages = []
    for h in history:
        if h["role"] == "user":
            messages.append(HumanMessage(content=h["content"]))
        elif h["role"] == "assistant":
            messages.append(AIMessage(content=h["content"]))

    messages.append(HumanMessage(content=message))

    await timeline_start(session_id, "Customer requested refund")
    await timeline(session_id, "Customer requested refund", "success", message[:120])

    result = await agent.ainvoke(
        {"messages": messages, "session_id": session_id},
        config={"recursion_limit": 15},
    )

    last = result["messages"][-1]
    response = last.content if hasattr(last, "content") else str(last)
    decision = _extract_decision_from_messages(result["messages"], session_id)
    if decision:
        status = "Approved" if decision["status"] == "approved" else "Denied"
        detail = decision.get("reference") or decision.get("primary_reason", "")
        await timeline_decision(
            session_id, status, decision["confidence"], detail,
            decision.get("decision_json"), decision,
        )
    return response, decision


def _parse_tool_result(content: str) -> dict | None:
    try:
        return ast.literal_eval(content)
    except (ValueError, SyntaxError):
        return None


def _extract_decision_from_messages(messages: list, session_id: str) -> Optional[dict]:
    eligibility = None
    action_result = None
    approved = None

    for msg in messages:
        if not isinstance(msg, ToolMessage):
            continue
        parsed = _parse_tool_result(msg.content)
        if not isinstance(parsed, dict):
            continue
        if "eligible" in parsed and "checks" in parsed:
            eligibility = parsed
        elif parsed.get("success") and "refund_reference" in parsed:
            action_result = parsed
            approved = True
        elif parsed.get("success") and "denial_reference" in parsed:
            action_result = parsed
            approved = False

    if eligibility is None or approved is None:
        return None

    if approved:
        return build_decision(
            eligibility,
            approved=True,
            reference=action_result.get("refund_reference") if action_result else None,
            amount=action_result.get("amount") if action_result else None,
            item_name=action_result.get("item_name") if action_result else None,
        )
    return build_decision(
        eligibility,
        approved=False,
        reference=action_result.get("denial_reference") if action_result else None,
        primary_reason=action_result.get("denial_reason") if action_result else None,
    )
