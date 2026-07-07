"""
RADAR — WebSocket Connection Manager
Manages all connected dashboard clients.
Broadcasts events to all clients; handles disconnects gracefully.
"""
import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

log = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    @property
    def count(self) -> int:
        return len(self._connections)

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
        log.info(f"WS client connected. Total: {self.count}")

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)
        log.info(f"WS client disconnected. Total: {self.count}")

    async def broadcast(self, message: dict) -> None:
        """Broadcast to all connected clients; silently remove dead connections."""
        if not self._connections:
            return

        data = json.dumps(message, default=str)
        dead: set[WebSocket] = set()

        async with self._lock:
            clients = set(self._connections)

        results = await asyncio.gather(
            *[self._send(ws, data) for ws in clients],
            return_exceptions=True,
        )

        for ws, result in zip(clients, results):
            if isinstance(result, Exception):
                dead.add(ws)

        if dead:
            async with self._lock:
                self._connections -= dead
            log.debug(f"Removed {len(dead)} dead WS connections")

    async def _send(self, ws: WebSocket, data: str) -> None:
        await ws.send_text(data)


# Singleton used across all routers
manager = ConnectionManager()
