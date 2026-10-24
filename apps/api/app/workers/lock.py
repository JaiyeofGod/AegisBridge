"""Valkey lock for one vulnerability-intelligence synchronization at a time."""

from __future__ import annotations

from typing import Protocol
from uuid import uuid4

from redis import Redis

LOCK_KEY = "aegis:lock:vulnerability_intelligence_sync"
_RELEASE = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
end
return 0
"""


class SyncLock(Protocol):
    def acquire(self) -> str | None: ...

    def release(self, token: str) -> None: ...


class RedisSyncLock:
    """SET NX with a TTL. Release deletes the key only when the token still matches."""

    def __init__(self, client: Redis, ttl_seconds: int, key: str = LOCK_KEY) -> None:
        self._client = client
        self._ttl_seconds = ttl_seconds
        self._key = key

    def acquire(self) -> str | None:
        token = uuid4().hex
        held = self._client.set(self._key, token, nx=True, ex=self._ttl_seconds)
        if not held:
            return None
        return token

    def release(self, token: str) -> None:
        self._client.eval(_RELEASE, 1, self._key, token)
