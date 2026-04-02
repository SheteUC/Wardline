"""
Session persistence: optional Redis backing for multi-instance / restart survival.
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Optional

from models import SessionState

if TYPE_CHECKING:
    from redis.asyncio import Redis

logger = logging.getLogger(__name__)


class SessionStore:
    """Authoritative session serialization when Redis is enabled; otherwise in-process only."""

    def __init__(
        self,
        *,
        redis_client: Optional[Redis] = None,
        key_prefix: str = "wardline:v2:session:",
        ttl_seconds: int = 4 * 3600,
    ):
        self._redis = redis_client
        self._prefix = key_prefix
        self._ttl = max(60, int(ttl_seconds))

    def _key(self, session_id: str) -> str:
        return f"{self._prefix}{session_id}"

    async def save(self, session: SessionState) -> None:
        if not self._redis:
            return
        try:
            payload = json.dumps(session.model_dump(mode="json"))
            await self._redis.set(self._key(session.sessionId), payload, ex=self._ttl)
        except Exception:
            logger.exception("Failed to persist session %s to Redis", session.sessionId)
            raise

    async def load(self, session_id: str) -> Optional[SessionState]:
        if not self._redis:
            return None
        try:
            raw = await self._redis.get(self._key(session_id))
            if not raw:
                return None
            if isinstance(raw, (bytes, bytearray)):
                raw = raw.decode("utf-8")
            return SessionState.model_validate(json.loads(raw))
        except Exception:
            logger.exception("Failed to load session %s from Redis", session_id)
            raise

    async def delete(self, session_id: str) -> None:
        if not self._redis:
            return
        try:
            await self._redis.delete(self._key(session_id))
        except Exception:
            logger.exception("Failed to delete session %s from Redis", session_id)
            raise
