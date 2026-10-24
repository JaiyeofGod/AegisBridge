"""Celery application. Valkey is the broker. Synchronization status is stored in PostgreSQL."""

import os

from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

# A stale environment value must not enable broker-side task results.
os.environ.pop("CELERY_RESULT_BACKEND", None)

settings = get_settings()

celery_app = Celery("aegisbridge", broker=settings.celery_broker())
celery_app.conf.update(
    broker_url=settings.celery_broker(),
    result_backend=None,
    task_ignore_result=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    event_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_queue="intelligence",
    # Prefork children on Python 3.14/macOS use spawn and lose Celery's
    # in-process trace state. One solo process is the local worker.
    worker_pool="solo",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "vulnerability-intelligence-daily": {
            "task": "intelligence.sync_vulnerability_intelligence",
            "schedule": crontab(hour=settings.vulnerability_sync_hour_utc, minute=0),
            "options": {"queue": "intelligence"},
        },
        # 00:15, 06:15, 12:15, and 18:15 UTC. Offset from the 06:00 vulnerability sync.
        "threat-intelligence-iocs": {
            "task": "intelligence.sync_threat_intelligence_iocs",
            "schedule": crontab(hour="*/6", minute=15),
            "options": {"queue": "intelligence"},
        },
        # Alerts are time-sensitive. Five minutes stays above the one-minute floor
        # and overlaps the 15-minute lookback so a delayed poll still deduplicates.
        "wazuh-alert-sync": {
            "task": "soc.sync_wazuh_alerts",
            "schedule": crontab(minute="*/5"),
            "options": {"queue": "integrations"},
        },
    },
)

import app.workers.tasks as _tasks  # noqa: E402

_ = _tasks
