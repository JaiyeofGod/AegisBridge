"""Optional Redis/Valkey readiness probe for health endpoints."""

import contextlib

from redis import Redis

from app.core.config import Settings, get_settings


def check_redis_ready(settings: Settings | None = None, timeout_seconds: float = 1.0) -> bool:
    cfg = settings or get_settings()
    client: Redis | None = None
    try:
        client = Redis.from_url(cfg.redis_url, socket_connect_timeout=timeout_seconds)
        return client.ping() is True
    except Exception:
        return False
    finally:
        if client is not None:
            with contextlib.suppress(Exception):
                client.close()
