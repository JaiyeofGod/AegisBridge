"""Read-only alert references."""

from fastapi import APIRouter

from app.api.deps import DbSession, PageQuery
from app.schemas.alerts import AlertDetail, AlertListItem
from app.schemas.common import ErrorBody, Page
from app.services.alerts import get_alert, list_alerts

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=Page[AlertListItem])
def read_alerts(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    asset: str | None = None,
    attack_technique: str | None = None,
) -> Page[AlertListItem]:
    return list_alerts(
        session,
        page,
        search=search,
        severity=severity,
        status=status,
        asset=asset,
        attack_technique=attack_technique,
    )


@router.get("/{alert_id}", response_model=AlertDetail, responses={404: {"model": ErrorBody}})
def read_alert(alert_id: str, session: DbSession) -> AlertDetail:
    return get_alert(session, alert_id)
