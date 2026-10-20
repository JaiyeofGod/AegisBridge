"""Threat-intelligence reads. Counts come from stored rows, not live feeds."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import not_found
from app.models.threat_intel import ThreatAdvisory, ThreatIndicator, ThreatIntelSource
from app.schemas.common import Page, RelatedRecord
from app.schemas.threat_intel import (
    AdvisoryListItem,
    AttackRef,
    IndicatorDetail,
    IndicatorListItem,
    SourceRef,
    ThreatIntelSummary,
    ThreatSourceItem,
)
from app.services.support import PageParams, like_pattern, page, paginate, require_choice

INDICATOR_TYPES = frozenset({"ip", "domain", "url", "file_hash"})
INDICATOR_STATUSES = frozenset({"active", "expired", "retracted"})
DATA_ORIGIN = "simulated"
SUMMARY_SEMANTICS = (
    "Counts are stored development records. "
    "reference_only and not_connected mean the named feed is not connected. "
    "Reserved example addresses are simulated indicators, not live threat intelligence."
)


def get_summary(session: Session) -> ThreatIntelSummary:
    active = int(
        session.scalar(
            select(func.count())
            .select_from(ThreatIndicator)
            .where(func.lower(ThreatIndicator.status) == "active")
        )
        or 0
    )
    matches = int(
        session.scalar(
            select(func.count())
            .select_from(ThreatIndicator)
            .where(ThreatIndicator.internal_match.is_(True))
        )
        or 0
    )
    advisories = int(session.scalar(select(func.count()).select_from(ThreatAdvisory)) or 0)
    statuses = session.scalars(select(ThreatIntelSource.connection_status)).all()
    health: dict[str, int] = {}
    for status in statuses:
        health[status] = health.get(status, 0) + 1
    return ThreatIntelSummary(
        active_indicator_count=active,
        internal_match_count=matches,
        advisory_count=advisories,
        source_health=health,
        data_origin=DATA_ORIGIN,
        semantics=SUMMARY_SEMANTICS,
    )


def list_indicators(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    indicator_type: str | None = None,
    source: str | None = None,
    status: str | None = None,
    internal_match: bool | None = None,
) -> Page[IndicatorListItem]:
    indicator_type = require_choice("indicator_type", indicator_type, INDICATOR_TYPES)
    status = require_choice("status", status, INDICATOR_STATUSES)
    statement = (
        select(ThreatIndicator)
        .options(
            selectinload(ThreatIndicator.source),
            selectinload(ThreatIndicator.attack_technique),
            selectinload(ThreatIndicator.matched_asset),
        )
        .order_by(ThreatIndicator.last_seen.desc(), ThreatIndicator.human_id)
    )
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                ThreatIndicator.value.ilike(term, escape="\\"),
                ThreatIndicator.human_id.ilike(term, escape="\\"),
                ThreatIndicator.summary.ilike(term, escape="\\"),
            )
        )
    if indicator_type:
        statement = statement.where(ThreatIndicator.indicator_type == indicator_type)
    if status:
        statement = statement.where(ThreatIndicator.status == status)
    if internal_match is not None:
        statement = statement.where(ThreatIndicator.internal_match.is_(internal_match))
    if source:
        token = source.strip().lower()
        statement = statement.where(
            ThreatIndicator.source.has(
                or_(
                    func.lower(ThreatIntelSource.human_id) == token,
                    func.lower(ThreatIntelSource.name) == token,
                )
            )
        )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_indicator(row) for row in rows])


def get_indicator(session: Session, indicator_id: str) -> IndicatorDetail:
    row = session.scalar(
        select(ThreatIndicator)
        .where(ThreatIndicator.human_id == indicator_id)
        .options(
            selectinload(ThreatIndicator.source),
            selectinload(ThreatIndicator.attack_technique),
            selectinload(ThreatIndicator.matched_asset),
        )
    )
    if row is None:
        raise not_found("Indicator", indicator_id)
    base = _indicator(row)
    attack = None
    if row.attack_technique is not None:
        attack = AttackRef(
            technique_id=row.attack_technique.technique_id,
            name=row.attack_technique.name,
            tactic=row.attack_technique.tactic,
        )
    matched = None
    if row.matched_asset is not None:
        matched = RelatedRecord(
            id=row.matched_asset.human_id,
            title=row.matched_asset.hostname,
            status=None,
            summary="Simulated internal-match label. Not a confirmed compromise.",
        )
    return IndicatorDetail(
        **base.model_dump(),
        summary=row.summary,
        attack=attack,
        matched_asset=matched,
        data_origin=DATA_ORIGIN,
    )


def list_advisories(session: Session, page_params: PageParams) -> Page[AdvisoryListItem]:
    statement = (
        select(ThreatAdvisory)
        .options(selectinload(ThreatAdvisory.source))
        .order_by(ThreatAdvisory.human_id)
    )
    total, rows = paginate(session, statement, page_params)
    return page(
        page_params,
        total,
        [
            AdvisoryListItem(
                id=row.human_id,
                title=row.title,
                summary=row.summary,
                status=row.status,
                confidence=row.confidence,
                related_cve=row.related_cve,
                published_at=row.published_at,
                source=_source_ref(row.source),
            )
            for row in rows
        ],
    )


def list_sources(session: Session, page_params: PageParams) -> Page[ThreatSourceItem]:
    statement = select(ThreatIntelSource).order_by(ThreatIntelSource.human_id)
    total, rows = paginate(session, statement, page_params)
    return page(
        page_params,
        total,
        [
            ThreatSourceItem(
                id=row.human_id,
                name=row.name,
                provider=row.provider,
                purpose=row.purpose,
                connection_status=row.connection_status,
                notes=row.notes,
            )
            for row in rows
        ],
    )


def _indicator(row: ThreatIndicator) -> IndicatorListItem:
    return IndicatorListItem(
        id=row.human_id,
        indicator_type=row.indicator_type,
        value=row.value,
        confidence=row.confidence,
        severity=row.severity,
        source=_source_ref(row.source),
        first_seen=row.first_seen,
        last_seen=row.last_seen,
        status=row.status,
        internal_match=row.internal_match,
        attack_technique_id=(
            None if row.attack_technique is None else row.attack_technique.technique_id
        ),
        matched_asset_id=None if row.matched_asset is None else row.matched_asset.human_id,
    )


def _source_ref(source: ThreatIntelSource) -> SourceRef:
    return SourceRef(
        id=source.human_id,
        name=source.name,
        connection_status=source.connection_status,
    )
