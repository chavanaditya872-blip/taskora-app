"""Per-user WebSocket connection manager.

Design supports multiple concurrent users; each authenticated user has a
dedicated set of active WebSocket connections (e.g., multiple tabs/devices).
Broadcasts are scoped to the user id, so users never receive another user's
events.
"""
import asyncio
import json
from collections import defaultdict
from typing import Any, DefaultDict, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: DefaultDict[int, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[user_id].add(websocket)

    async def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._connections.get(user_id)
            if conns and websocket in conns:
                conns.remove(websocket)
            if conns is not None and not conns:
                self._connections.pop(user_id, None)

    async def broadcast_to_user(self, user_id: int, event: str, payload: Any) -> None:
        """Send a JSON event to all connections of a given user."""
        message = json.dumps({"event": event, "data": payload}, default=str)
        async with self._lock:
            targets = list(self._connections.get(user_id, set()))

        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                conns = self._connections.get(user_id)
                if conns:
                    for ws in dead:
                        conns.discard(ws)


manager = ConnectionManager()