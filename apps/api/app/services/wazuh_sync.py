"""Poll recent Wazuh indexer alerts into existing SOC alert references.

The indexer request finishes before a database transaction opens. A failed poll
does not delete alerts already stored. New rows stay in the neutral triage
status and do not open incidents.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import SessionLocal
from app.integrations.wazuh.alerts import normalize_hits
from app.integrations.wazuh.client import HttpxWazuhClient
from app.integrations.wazuh.errors import WazuhError
from app.integrations.wazuh.models import NormalizedWazuhAlert, WazuhAlertClient
from app.models.integration import Integration, IntegrationSyncRun, SyncState
from app.models.soc import AlertReference
from app.workers.lock import SyncLock

logger = logging.getLogger(__name__)

INTEGRATION_NAME = "wazuh"
_CATALOG_NAME = "Wazuh"
_NEUTRAL_STATUS = "new"
_UNSCORED_SEVERITY = "not_assigned"
SessionFactory = Callable[[], Session]


class WazuhSyncResult(TypedDict):
    status: str
    reason: str | None
    run_id: str | None
    received_count: int
    inserted_count: int
    duplicate_count: int
    skipped_count: int
    malformed_count: int


def sync_wazuh_alerts(
    *,
    lock: SyncLock,
    session_factory: SessionFactory = SessionLocal,
    client: WazuhAlertClient | None = None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> WazuhSyncResult:
    """Ingest one bounded lookback window. Disabled mode performs no I/O."""
    runtime = settings or get_settings()
    if not runtime.wazuh_enabled:
        return _result("skipped", "disabled")
    try:
        token = lock.acquire()
    except Exception:
        logger.error("wazuh alert sync lock unavailable")
        return _result("failed", "lock_unavailable")
    if token is None:
        return _result("skipped", "lock_held")
    owns_client = client is None
    wazuh = client or HttpxWazuhClient(runtime)
    started = time.monotonic()
    try:
        result = _run(session_factory, wazuh, runtime, now or datetime.now(UTC))
    finally:
        if owns_client:
            wazuh.close()
        try:
            lock.release(token)
        except Exception:
            logger.error("wazuh alert sync lock release failed")
    logger.info(
        "wazuh alert sync status=%s reason=%s received=%s inserted=%s duration_ms=%s",
        result["status"],
        result["reason"],
        result["received_count"],
        result["inserted_count"],
        int((time.monotonic() - started) * 1000),
    )
    return result


def _run(
    session_factory: SessionFactory,
    client: WazuhAlertClient,
    settings: Settings,
    moment: datetime,
) -> WazuhSyncResult:
    if not _configured(settings):
        run_id = _record(
            session_factory,
            status="skipped",
            moment=moment,
            summary="not_configured",
        )
        return _result("skipped", "not_configured", run_id=run_id)
    since = moment - timedelta(minutes=settings.wazuh_lookback())
    try:
        page = client.search(since=since, limit=settings.wazuh_alert_cap())
    except WazuhError as exc:
        logger.error("wazuh alert sync failed reason=%s", exc.reason)
        run_id = _record(
            session_factory,
            status="failed",
            moment=moment,
            summary=exc.reason,
        )
        return _result("failed", exc.reason, run_id=run_id)
    except Exception:
        logger.error("wazuh alert sync failed reason=source_error")
        run_id = _record(
            session_factory,
            status="failed",
            moment=moment,
            summary="source_error",
        )
        return _result("failed", "source_error", run_id=run_id)

    alerts, malformed = normalize_hits(page.hits)
    malformed += page.omitted
    unique, collapsed = _collapse(alerts)
    try:
        inserted, existing = _persist(session_factory, unique, moment)
    except WazuhError as exc:
        run_id = _record(
            session_factory,
            status="failed",
            moment=moment,
            received=len(page.hits) + page.omitted,
            malformed=malformed,
            summary=exc.reason,
        )
        return _result(
            "failed",
            exc.reason,
            run_id=run_id,
            received=len(page.hits) + page.omitted,
            malformed=malformed,
        )
    received = len(page.hits) + page.omitted
    skipped = max(page.total - received, 0)
    duplicate = collapsed + existing
    status = "partial" if malformed else "completed"
    summary = (
        f"received={received} inserted={inserted} duplicate={duplicate} "
        f"skipped={skipped} malformed={malformed}"
    )
    run_id = _record(
        session_factory,
        status=status,
        moment=moment,
        received=received,
        inserted=inserted,
        duplicate=duplicate,
        skipped=skipped,
        malformed=malformed,
        summary=summary,
    )
    return _result(
        status,
        None,
        run_id=run_id,
        received=received,
        inserted=inserted,
        duplicate=duplicate,
        skipped=skipped,
        malformed=malformed,
    )


def _configured(settings: Settings) -> bool:
    return bool(
        (settings.wazuh_indexer_url or "").strip()
        and (settings.wazuh_username or "").strip()
        and (settings.wazuh_password or "").strip()
    )


def _collapse(
    alerts: tuple[NormalizedWazuhAlert, ...],
) -> tuple[tuple[NormalizedWazuhAlert, ...], int]:
    chosen: dict[str, NormalizedWazuhAlert] = {}
    collapsed = 0
    for alert in alerts:
        if alert.source_alert_id in chosen:
            collapsed += 1
        chosen[alert.source_alert_id] = alert
    return tuple(chosen.values()), collapsed


def _persist(
    session_factory: SessionFactory,
    alerts: tuple[NormalizedWazuhAlert, ...],
    moment: datetime,
) -> tuple[int, int]:
    session = session_factory()
    try:
        integration = session.scalar(select(Integration).where(Integration.name == _CATALOG_NAME))
        if integration is None:
            raise WazuhError("not_configured")
        identifiers = [alert.source_alert_id for alert in alerts]
        existing_ids: set[str | None] = set()
        if identifiers:
            existing_ids = set(
                session.scalars(
                    select(AlertReference.wazuh_alert_id).where(
                        AlertReference.organization_id == integration.organization_id,
                        AlertReference.wazuh_alert_id.in_(identifiers),
                    )
                ).all()
            )
        fresh = [alert for alert in alerts if alert.source_alert_id not in existing_ids]
        human_ids = _allocate_ids(session, len(fresh))
        for human_id, alert in zip(human_ids, fresh, strict=True):
            session.add(_row(integration, human_id, alert, moment))
        _mark_connected(integration, moment)
        session.commit()
        return len(fresh), len(alerts) - len(fresh)
    except WazuhError:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        logger.error("wazuh alert persist failed")
        raise WazuhError("persist_failed") from None
    finally:
        session.close()


def _row(
    integration: Integration,
    human_id: str,
    alert: NormalizedWazuhAlert,
    moment: datetime,
) -> AlertReference:
    return AlertReference(
        organization_id=integration.organization_id,
        human_id=human_id,
        wazuh_alert_id=alert.source_alert_id,
        severity=_UNSCORED_SEVERITY,
        status=_NEUTRAL_STATUS,
        summary=alert.description,
        telemetry_source=INTEGRATION_NAME,
        observed_at=alert.observed_at,
        data_origin=INTEGRATION_NAME,
        source_rule_id=alert.rule_id,
        source_rule_level=alert.rule_level,
        source_agent_id=alert.agent_id,
        source_agent_name=alert.agent_name,
        source_manager_name=alert.manager_name,
        source_decoder=alert.decoder_name,
        source_src_ip=alert.source_ip,
        source_dst_ip=alert.destination_ip,
        source_username=alert.username,
        source_fetched_at=moment,
        rule_groups=list(alert.groups),
        attack_technique_ids=list(alert.technique_ids),
        attack_tactics=list(alert.tactics),
    )


def _mark_connected(integration: Integration, moment: datetime) -> None:
    integration.status = "configured"
    integration.auth_state = "Server credentials configured"
    state = integration.sync_state
    if state is None:
        state = SyncState(integration_id=integration.id, freshness="healthy")
        integration.sync_state = state
    state.freshness = "healthy"
    state.last_success_at = moment
    state.cursor_label = "lookback"


def _allocate_ids(session: Session, count: int) -> list[str]:
    if count == 0:
        return []
    existing = session.scalars(
        select(AlertReference.human_id).where(AlertReference.human_id.like("AL-%"))
    ).all()
    highest = 0
    for value in existing:
        suffix = value.rsplit("-", maxsplit=1)[-1]
        if suffix.isdigit():
            highest = max(highest, int(suffix))
    return [f"AL-{highest + offset:04d}" for offset in range(1, count + 1)]


def _record(
    session_factory: SessionFactory,
    *,
    status: str,
    moment: datetime,
    received: int = 0,
    inserted: int = 0,
    duplicate: int = 0,
    skipped: int = 0,
    malformed: int = 0,
    summary: str,
) -> str | None:
    session = session_factory()
    try:
        run = IntegrationSyncRun(
            integration=INTEGRATION_NAME,
            status=status,
            started_at=moment,
            finished_at=datetime.now(UTC),
            received_count=received,
            inserted_count=inserted,
            duplicate_count=duplicate,
            skipped_count=skipped,
            malformed_count=malformed,
            summary=summary[:500],
        )
        session.add(run)
        session.commit()
        return str(run.id)
    except Exception:
        session.rollback()
        logger.error("wazuh alert sync run record failed")
        return None
    finally:
        session.close()


def _result(
    status: str,
    reason: str | None,
    *,
    run_id: str | None = None,
    received: int = 0,
    inserted: int = 0,
    duplicate: int = 0,
    skipped: int = 0,
    malformed: int = 0,
) -> WazuhSyncResult:
    return {
        "status": status,
        "reason": reason,
        "run_id": run_id,
        "received_count": received,
        "inserted_count": inserted,
        "duplicate_count": duplicate,
        "skipped_count": skipped,
        "malformed_count": malformed,
    }
