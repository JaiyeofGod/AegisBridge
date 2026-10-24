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
        }
    },
)

import app.workers.tasks as _tasks  # noqa: E402

_ = _tasks
