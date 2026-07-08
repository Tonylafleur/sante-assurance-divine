from fastapi import WebSocket
from typing import Dict, List
import json


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        self.active_connections[channel].append(websocket)

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections:
            self.active_connections[channel].remove(websocket)

    async def broadcast(self, channel: str, data: dict):
        """Diffuse un message à tous les clients d'un canal."""
        if channel in self.active_connections:
            message = json.dumps(data, ensure_ascii=False)
            dead = []
            for connection in self.active_connections[channel]:
                try:
                    await connection.send_text(message)
                except Exception:
                    dead.append(connection)
            for conn in dead:
                self.active_connections[channel].remove(conn)

    async def broadcast_all(self, data: dict):
        """Diffuse à tous les canaux."""
        for channel in list(self.active_connections.keys()):
            await self.broadcast(channel, data)


manager = ConnectionManager()


# Canaux définis
CANAL_PHARMACIE = "pharmacie"
CANAL_CAISSE = "caisse"
CANAL_ACCUEIL = "accueil"
CANAL_LABORATOIRE = "laboratoire"
CANAL_NOTIFICATIONS = "notifications"
