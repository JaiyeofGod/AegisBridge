"""Ingest recent ThreatFox and URLhaus indicators.

HTTP finishes before a database transaction opens. One source failing does not
delete or roll back the other source. Historical indicators are not expired here.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import SessionLocal
from app.integrations.threat_intel.errors import ThreatFeedError
from app.integrations.threat_intel.http import FeedClient, HttpxFeedClient
from app.integrations.threat_intel.models import FeedBatch, NormalizedIoc
from app.integrations.threat_intel.threatfox import fetch_threatfox
from app.integrations.threat_intel.urlhaus import fetch_urlhaus
from app.models.intelligence_sync import IntelligenceSyncRun
from app.models.threat_intel import ThreatIndicator, ThreatIntelSource
from app.workers.lock import SyncLock

logger = logging.getLogger(__name__)

SYNC_TYPE = "threat_intelligence_iocs"
THREATFOX_SOURCE = "SRC-0004"
URLHAUS_SOURCE = "SRC-0005"
_SOURCE_NOTES = {
    THREATFOX_SOURCE: (
        "Recent ThreatFox indicators were ingested with the server abuse.ch Auth-Key. "
        "A listed indicator is not an asset compromise."
    ),
    URLHAUS_SOURCE: (
        "Recent URLhaus URLs were ingested with the server abuse.ch Auth-Key. "
        "A listed URL is not an asset compromise, exploitation, or infection."
    ),
}
SessionFactory = Callable[[], Session]


class ThreatIocSyncResult(TypedDict):
    status: str
    reason: str | None
    run_id: str | None
    threatfox_count: int
    urlhaus_count: int
    ioc_inserted_count: int
    ioc_updated_count: int
    ioc_skipped_count: int
    failed_source_count: int


@dataclass
class _WriteCounts:
    inserted: int = 0
    updated: int = 0
    collapsed: int = 0


def sync_threat_intelligence_iocs(
    *,
    session_factory: SessionFactory = SessionLocal,
    client: FeedClient | None = None,
    settings: Settings | None = None,
    lock: SyncLock,
    now: datetime | None = None,
) -> ThreatIocSyncResult:
    """Fetch both feeds, then upsert each source in its own transaction."""
    runtime = settings or get_settings()
    if not runtime.threat_intel_sync_enabled:
        return _result("skipped", reason="disabled")
    if not (runtime.abusech_auth_key or "").strip():
        logger.info("threat intelligence ioc sync skipped reason=auth_unconfigured")
        return _result("skipped", reason="auth_unconfigured")
    try:
        token = lock.acquire()
    except Exception:
        logger.error("threat intelligence ioc sync lock unavailable")
        return _result("failed", reason="lock_unavailable")
    if token is None:
        return _result("skipped", reason="lock_held")
    owns_client = client is None
    feed_client = client or HttpxFeedClient(runtime)
    started = time.monotonic()
    try:
        result = _run(
            session_factory,
            feed_client,
            runtime,
            now or datetime.now(UTC),
        )
    finally:
        if owns_client:
            feed_client.close()
        try:
            lock.release(token)
        except Exception:
            logger.error("threat intelligence ioc sync lock release failed")
    logger.info(
        "threat intelligence ioc sync status=%s reason=%s run_id=%s "
        "threatfox=%s urlhaus=%s duration_ms=%s",
        result["status"],
        result["reason"],
        result["run_id"],
        result["threatfox_count"],
        result["urlhaus_count"],
        int((time.monotonic() - started) * 1000),
    )
    return result


def _run(
    session_factory: SessionFactory,
    client: FeedClient,
    settings: Settings,
    moment: datetime,
) -> ThreatIocSyncResult:
    threatfox_error: str | None
    urlhaus_error: str | None
    threatfox_batch = FeedBatch((), 0)
    urlhaus_batch = FeedBatch((), 0)
    if not (settings.abusech_auth_key or "").strip():
        threatfox_error = "auth_unconfigured"
        urlhaus_error = "auth_unconfigured"
    else:
        threatfox_batch, threatfox_error = _pull(
            "threatfox",
            lambda: fetch_threatfox(settings, client),
        )
        urlhaus_batch, urlhaus_error = _pull(
            "urlhaus",
            lambda: fetch_urlhaus(settings, client),
        )

    threatfox_counts = _WriteCounts()
    urlhaus_counts = _WriteCounts()
    if threatfox_error is None:
        threatfox_counts, threatfox_error = _store(
            session_factory,
            THREATFOX_SOURCE,
            threatfox_batch,
            moment,
        )
    if urlhaus_error is None:
        urlhaus_counts, urlhaus_error = _store(
            session_factory,
            URLHAUS_SOURCE,
            urlhaus_batch,
            moment,
        )

    failures = int(threatfox_error is not None) + int(urlhaus_error is not None)
    if failures == 2:
        status = "failed"
    elif failures == 1:
        status = "partial"
    else:
        status = "completed"
    inserted = threatfox_counts.inserted + urlhaus_counts.inserted
    updated = threatfox_counts.updated + urlhaus_counts.updated
    skipped = (
        threatfox_batch.skipped
        + urlhaus_batch.skipped
        + threatfox_counts.collapsed
        + urlhaus_counts.collapsed
    )
    summary = (
        f"threatfox={threatfox_counts.inserted + threatfox_counts.updated} "
        f"urlhaus={urlhaus_counts.inserted + urlhaus_counts.updated} "
        f"inserted={inserted} updated={updated} skipped={skipped} "
        f"threatfox_status={threatfox_error or 'ok'} "
        f"urlhaus_status={urlhaus_error or 'ok'}"
    )[:500]
    run_id = _record_run(
        session_factory,
        status=status,
        moment=moment,
        threatfox_count=threatfox_counts.inserted + threatfox_counts.updated,
        urlhaus_count=urlhaus_counts.inserted + urlhaus_counts.updated,
        inserted=inserted,
        updated=updated,
        skipped=skipped,
        failures=failures,
        summary=summary,
    )
    return _result(
        status,
        reason=None,
        run_id=run_id,
        threatfox_count=threatfox_counts.inserted + threatfox_counts.updated,
        urlhaus_count=urlhaus_counts.inserted + urlhaus_counts.updated,
        ioc_inserted_count=inserted,
        ioc_updated_count=updated,
        ioc_skipped_count=skipped,
        failed_source_count=failures,
    )


def _pull(
    source: str,
    fetch: Callable[[], FeedBatch],
) -> tuple[FeedBatch, str | None]:
    try:
        return fetch(), None
    except ThreatFeedError as exc:
        logger.error(
            "threat intelligence source failed source=%s reason=%s",
            source,
            exc.reason,
        )
        return FeedBatch((), 0), exc.reason
    except Exception:
        logger.error("threat intelligence source failed source=%s reason=source_error", source)
        return FeedBatch((), 0), "source_error"


def _store(
    session_factory: SessionFactory,
    source_human_id: str,
    batch: FeedBatch,
    moment: datetime,
) -> tuple[_WriteCounts, str | None]:
    records, collapsed = _collapse(batch.records)
    session = session_factory()
    counts = _WriteCounts()
    try:
        counts = _upsert(session, source_human_id, records, moment)
        counts.collapsed = collapsed
        session.commit()
    except ThreatFeedError as exc:
        session.rollback()
        logger.error(
            "threat intelligence persist failed source=%s reason=%s",
            source_human_id,
            exc.reason,
        )
        return _WriteCounts(), exc.reason
    except Exception:
        session.rollback()
        logger.error("threat intelligence persist failed source=%s", source_human_id)
        return _WriteCounts(), "persist_failed"
    finally:
        session.close()
    return counts, None


def _collapse(records: tuple[NormalizedIoc, ...]) -> tuple[tuple[NormalizedIoc, ...], int]:
    chosen: dict[tuple[str, str], NormalizedIoc] = {}
    collapsed = 0
    for record in records:
        key = (record.indicator_subtype, record.normalized_value)
        if key in chosen:
            collapsed += 1
        chosen[key] = record
    return tuple(chosen.values()), collapsed


def _upsert(
    session: Session,
    source_human_id: str,
    records: tuple[NormalizedIoc, ...],
    moment: datetime,
) -> _WriteCounts:
    source = session.scalar(
        select(ThreatIntelSource).where(ThreatIntelSource.human_id == source_human_id)
    )
    if source is None:
        raise ThreatFeedError("source_missing")
    counts = _WriteCounts()
    pending = [record for record in records if _existing(session, source.id, record) is None]
    new_ids = iter(_allocate_ids(session, len(pending)))
    for record in records:
        current = _existing(session, source.id, record)
        if current is None:
            _insert(session, source, record, next(new_ids), moment)
            counts.inserted += 1
        else:
            _update(current, record, moment)
            counts.updated += 1
    source.connection_status = "healthy"
    source.notes = _SOURCE_NOTES[source_human_id]
    return counts


def _existing(session: Session, source_id: object, record: NormalizedIoc) -> ThreatIndicator | None:
    return session.scalar(
        select(ThreatIndicator).where(
            ThreatIndicator.source_id == source_id,
            ThreatIndicator.indicator_subtype == record.indicator_subtype,
            ThreatIndicator.normalized_value == record.normalized_value,
        )
    )


def _insert(
    session: Session,
    source: ThreatIntelSource,
    record: NormalizedIoc,
    human_id: str,
    moment: datetime,
) -> None:
    first_seen = record.first_seen or moment
    session.add(
        ThreatIndicator(
            organization_id=source.organization_id,
            source_id=source.id,
            human_id=human_id,
            indicator_type=record.indicator_type,
            indicator_subtype=record.indicator_subtype,
            value=record.observed_value,
            normalized_value=record.normalized_value,
            confidence=None,
            severity=None,
            status="active",
            internal_match=False,
            first_seen=first_seen,
            last_seen=record.last_seen or first_seen,
            summary=record.summary,
            source_record_id=record.source_record_id,
            threat_type=record.threat_type,
            malware_family=record.malware_family,
            tags=list(record.tags),
            source_confidence=record.source_confidence,
            source_status=record.source_status,
            reference_url=record.reference_url,
            fetched_at=moment,
        )
    )


def _update(row: ThreatIndicator, record: NormalizedIoc, moment: datetime) -> None:
    row.value = record.observed_value
    row.summary = record.summary
    row.source_record_id = record.source_record_id
    row.threat_type = record.threat_type
    row.malware_family = record.malware_family
    row.tags = list(record.tags)
    row.source_confidence = record.source_confidence
    row.source_status = record.source_status
    row.reference_url = record.reference_url
    row.fetched_at = moment
    if record.first_seen is not None and record.first_seen < row.first_seen:
        row.first_seen = record.first_seen
    if record.last_seen is not None:
        row.last_seen = record.last_seen


def _allocate_ids(session: Session, count: int) -> list[str]:
    if count == 0:
        return []
    existing = session.scalars(
        select(ThreatIndicator.human_id).where(ThreatIndicator.human_id.like("IOC-%"))
    ).all()
    highest = 0
    for value in existing:
        suffix = value.rsplit("-", 1)[-1]
        if suffix.isdigit():
            highest = max(highest, int(suffix))
    return [f"IOC-{highest + offset:04d}" for offset in range(1, count + 1)]


def _record_run(
    session_factory: SessionFactory,
    *,
    status: str,
    moment: datetime,
    threatfox_count: int,
    urlhaus_count: int,
    inserted: int,
    updated: int,
    skipped: int,
    failures: int,
    summary: str,
) -> str | None:
    session = session_factory()
    try:
        run = IntelligenceSyncRun(
            sync_type=SYNC_TYPE,
            status=status,
            started_at=moment,
            finished_at=datetime.now(UTC),
            failed_source_count=failures,
            threatfox_count=threatfox_count,
            urlhaus_count=urlhaus_count,
            ioc_inserted_count=inserted,
            ioc_updated_count=updated,
            ioc_skipped_count=skipped,
            summary=summary,
        )
        session.add(run)
        session.commit()
        return str(run.id)
    except Exception:
        session.rollback()
        logger.error("threat intelligence ioc sync run record failed")
        return None
    finally:
        session.close()


def _result(
    status: str,
    *,
    reason: str | None,
    run_id: str | None = None,
    threatfox_count: int = 0,
    urlhaus_count: int = 0,
    ioc_inserted_count: int = 0,
    ioc_updated_count: int = 0,
    ioc_skipped_count: int = 0,
    failed_source_count: int = 0,
) -> ThreatIocSyncResult:
    return {
        "status": status,
        "reason": reason,
        "run_id": run_id,
        "threatfox_count": threatfox_count,
        "urlhaus_count": urlhaus_count,
        "ioc_inserted_count": ioc_inserted_count,
        "ioc_updated_count": ioc_updated_count,
        "ioc_skipped_count": ioc_skipped_count,
        "failed_source_count": failed_source_count,
    }
