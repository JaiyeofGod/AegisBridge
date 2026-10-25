"""Per-process sign-in limit. This is not a distributed lockout."""

from __future__ import annotations

import threading
import time
from collections import deque


class LoginRateLimiter:
    """Allow a fixed number of attempts per client key inside a sliding window."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        moment = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            cutoff = moment - self.window_seconds
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(moment)
            return True


_limiter: LoginRateLimiter | None = None


def get_login_rate_limiter(limit: int, window_seconds: int) -> LoginRateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = LoginRateLimiter(limit, window_seconds)
    return _limiter
