from datetime import datetime
from typing import Any
from fastapi import WebSocket


class LogBroadcaster:
    """Broadcasts agent reasoning logs to connected admin dashboard clients."""

    def __init__(self):
        self.connections: list[WebSocket] = []
        self.log_history: list[dict] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connections.append(websocket)
        for entry in self.log_history[-80:]:
            await websocket.send_json(entry)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.connections:
            self.connections.remove(websocket)

    async def broadcast(self, event_type: str, data: Any, session_id: str = ""):
        now = datetime.now()
        entry = {
            "type": event_type,
            "data": data,
            "session_id": session_id,
            "time": now.strftime("%H:%M:%S"),
            "timestamp": now.timestamp(),
        }
        self.log_history.append(entry)
        if len(self.log_history) > 300:
            self.log_history = self.log_history[-300:]

        dead = []
        for ws in self.connections:
            try:
                await ws.send_json(entry)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


log_broadcaster = LogBroadcaster()
