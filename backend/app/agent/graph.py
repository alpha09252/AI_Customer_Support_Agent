import os
from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.agent.tools import ALL_TOOLS
from app.agent.prompts import SYSTEM_PROMPT
from app.websocket import log_broadcaster


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

        if response.content:
            await log_broadcaster.broadcast(
                "reasoning",
                {"content": response.content, "role": "agent"},
                state.get("session_id", ""),
            )

        if response.tool_calls:
            for tc in response.tool_calls:
                await log_broadcaster.broadcast(
                    "tool_call",
                    {"tool": tc["name"], "args": tc["args"]},
                    state.get("session_id", ""),
                )

        return {"messages": [response]}

    async def run_tools(state: AgentState):
        result = await tool_node.ainvoke(state)

        for msg in result.get("messages", []):
            if isinstance(msg, ToolMessage):
                await log_broadcaster.broadcast(
                    "tool_result",
                    {"tool": msg.name, "result": msg.content[:500]},
                    state.get("session_id", ""),
                )

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


async def run_agent(message: str, history: list[dict], session_id: str) -> str:
    agent = get_agent()

    messages = []
    for h in history:
        if h["role"] == "user":
            messages.append(HumanMessage(content=h["content"]))
        elif h["role"] == "assistant":
            messages.append(AIMessage(content=h["content"]))

    messages.append(HumanMessage(content=message))

    await log_broadcaster.broadcast(
        "user_message",
        {"content": message},
        session_id,
    )

    result = await agent.ainvoke(
        {"messages": messages, "session_id": session_id},
        config={"recursion_limit": 15},
    )

    last = result["messages"][-1]
    return last.content if hasattr(last, "content") else str(last)
