"""Celery tasks. Ingestion logic lives in the service layer."""

from __future__ import annotations

import logging

from redis import Redis

from app.core.config import get_settings
from app.services.vulnerability_sync import SyncResult, sync_tracked_vulnerability_intelligence
from app.workers.celery_app import celery_app
from app.workers.lock import RedisSyncLock

logger = logging.getLogger(__name__)


@celery_app.task(  # type: ignore[untyped-decorator]
    name="intelligence.sync_vulnerability_intelligence",
    max_retries=0,
)
def sync_vulnerability_intelligence() -> SyncResult:
    """Daily tracked-CVE refresh. Arguments stay empty so the message has no secrets."""
    settings = get_settings()
    client = Redis.from_url(settings.celery_broker(), socket_connect_timeout=2.0)
    lock = RedisSyncLock(client, settings.vulnerability_sync_lock_ttl_seconds)
    try:
        return sync_tracked_vulnerability_intelligence(settings=settings, lock=lock)
    except Exception:
        logger.error("vulnerability intelligence synchronization failed")
        return {
            "status": "failed",
            "reason": "orchestration_error",
            "run_id": None,
            "tracked_cve_count": 0,
            "nvd_updated_count": 0,
            "kev_updated_count": 0,
            "epss_updated_count": 0,
            "failed_source_count": 0,
        }
    finally:
        client.close()
