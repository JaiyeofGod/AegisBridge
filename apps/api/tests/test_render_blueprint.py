"""The unapplied blueprint matches the launch contract and current schedules."""

from __future__ import annotations

from pathlib import Path

from app.core.blueprint import review_repository_blueprint
from app.workers.celery_app import celery_app

ROOT = Path(__file__).resolve().parents[3]


def test_render_blueprint_matches_the_launch_contract() -> None:
    assert review_repository_blueprint(ROOT) == ()


def test_owned_tasks_use_only_the_listened_queues() -> None:
    owned = [task for name, task in celery_app.tasks.items() if not name.startswith("celery.")]
    assert owned
    for task in owned:
        queue = getattr(task, "queue", None) or celery_app.conf.task_default_queue
        assert queue in {"intelligence", "integrations"}
    schedule = dict(celery_app.conf.beat_schedule)
    assert set(schedule) == {
        "vulnerability-intelligence-daily",
        "threat-intelligence-iocs",
        "wazuh-alert-sync",
    }
    vulnerability = schedule["vulnerability-intelligence-daily"]["schedule"]
    assert vulnerability.hour == {6}
    assert vulnerability.minute == {0}
    assert schedule["vulnerability-intelligence-daily"]["options"]["queue"] == "intelligence"
    assert schedule["threat-intelligence-iocs"]["options"]["queue"] == "intelligence"
    assert schedule["wazuh-alert-sync"]["options"]["queue"] == "integrations"
    indicators = schedule["threat-intelligence-iocs"]["schedule"]
    assert indicators.hour == {0, 6, 12, 18}
    assert indicators.minute == {15}
    wazuh = schedule["wazuh-alert-sync"]["schedule"]
    assert wazuh.minute == {0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55}
    assert celery_app.conf.worker_pool == "solo"
    assert celery_app.conf.result_backend is None
