"""Celery tasks. Ingestion logic lives in the service layer."""

from __future__ import annotations

import logging

from redis import Redis

from app.core.config import get_settings
from app.services.threat_intel_sync import ThreatIocSyncResult, sync_threat_intelligence_iocs
from app.services.vulnerability_sync import SyncResult, sync_tracked_vulnerability_intelligence
from app.services.wazuh_sync import WazuhSyncResult, sync_wazuh_alerts
from app.workers.celery_app import celery_app
from app.workers.lock import THREAT_IOC_LOCK_KEY, WAZUH_ALERT_LOCK_KEY, RedisSyncLock, SyncLock

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


@celery_app.task(  # type: ignore[untyped-decorator]
    name="intelligence.sync_threat_intelligence_iocs",
    max_retries=0,
)
def sync_threat_intelligence_iocs_task() -> ThreatIocSyncResult:
    """Periodic ThreatFox and URLhaus ingest. The message carries no arguments."""
    settings = get_settings()
    client = Redis.from_url(settings.celery_broker(), socket_connect_timeout=2.0)
    lock = RedisSyncLock(
        client,
        settings.threat_intel_sync_lock_ttl_seconds,
        key=THREAT_IOC_LOCK_KEY,
    )
    try:
        return sync_threat_intelligence_iocs(settings=settings, lock=lock)
    except Exception:
        logger.error("threat intelligence ioc synchronization failed")
        return {
            "status": "failed",
            "reason": "orchestration_error",
            "run_id": None,
            "threatfox_count": 0,
            "urlhaus_count": 0,
            "ioc_inserted_count": 0,
            "ioc_updated_count": 0,
            "ioc_skipped_count": 0,
            "failed_source_count": 0,
        }
    finally:
        client.close()


class _UnusedLock:
    """Disabled Wazuh polling must not touch Valkey or the indexer."""

    def acquire(self) -> str | None:
        raise RuntimeError("disabled wazuh sync must not take the lock")

    def release(self, token: str) -> None:
        return None


@celery_app.task(  # type: ignore[untyped-decorator]
    name="soc.sync_wazuh_alerts",
    max_retries=0,
    queue="integrations",
)
def sync_wazuh_alerts_task() -> WazuhSyncResult:
    """Periodic Wazuh alert poll. The message carries no arguments or credentials."""
    settings = get_settings()
    if not settings.wazuh_enabled:
        return sync_wazuh_alerts(settings=settings, lock=_UnusedLock())
    client = Redis.from_url(settings.celery_broker(), socket_connect_timeout=2.0)
    lock: SyncLock = RedisSyncLock(
        client,
        settings.wazuh_sync_lock_ttl_seconds,
        key=WAZUH_ALERT_LOCK_KEY,
    )
    try:
        return sync_wazuh_alerts(settings=settings, lock=lock)
    except Exception:
        logger.error("wazuh alert synchronization failed")
        return {
            "status": "failed",
            "reason": "orchestration_error",
            "run_id": None,
            "received_count": 0,
            "inserted_count": 0,
            "duplicate_count": 0,
            "skipped_count": 0,
            "malformed_count": 0,
        }
    finally:
        client.close()
