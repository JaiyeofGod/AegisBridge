"""Read-only threat-intelligence contracts."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, PageQuery, require_permissions
from app.schemas.common import ErrorBody, Page
from app.schemas.threat_intel import (
    AdvisoryListItem,
    IndicatorDetail,
    IndicatorListItem,
    ThreatIntelSummary,
    ThreatSourceItem,
)
from app.services.threat_intel import (
    get_indicator,
    get_summary,
    list_advisories,
    list_indicators,
    list_sources,
)

router = APIRouter(
    prefix="/threat-intelligence",
    tags=["threat-intelligence"],
    dependencies=[Depends(require_permissions("threat_intel.read"))],
)


@router.get("/summary", response_model=ThreatIntelSummary)
def read_summary(session: DbSession) -> ThreatIntelSummary:
    return get_summary(session)


@router.get("/indicators", response_model=Page[IndicatorListItem])
def read_indicators(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    indicator_type: str | None = None,
    source: str | None = None,
    status: str | None = None,
    internal_match: bool | None = None,
) -> Page[IndicatorListItem]:
    return list_indicators(
        session,
        page,
        search=search,
        indicator_type=indicator_type,
        source=source,
        status=status,
        internal_match=internal_match,
    )


@router.get(
    "/indicators/{indicator_id}",
    response_model=IndicatorDetail,
    responses={404: {"model": ErrorBody}},
)
def read_indicator(indicator_id: str, session: DbSession) -> IndicatorDetail:
    return get_indicator(session, indicator_id)


@router.get("/advisories", response_model=Page[AdvisoryListItem])
def read_advisories(session: DbSession, page: PageQuery) -> Page[AdvisoryListItem]:
    return list_advisories(session, page)


@router.get("/sources", response_model=Page[ThreatSourceItem])
def read_sources(session: DbSession, page: PageQuery) -> Page[ThreatSourceItem]:
    return list_sources(session, page)
