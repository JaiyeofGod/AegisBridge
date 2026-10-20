"""Read-only incidents."""

from fastapi import APIRouter

from app.api.deps import DbSession, PageQuery
from app.schemas.common import ErrorBody, Page
from app.schemas.incidents import IncidentDetail, IncidentListItem
from app.services.incidents import get_incident, list_incidents

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=Page[IncidentListItem])
def read_incidents(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    owner: str | None = None,
    containment_state: str | None = None,
) -> Page[IncidentListItem]:
    return list_incidents(
        session,
        page,
        search=search,
        severity=severity,
        status=status,
        owner=owner,
        containment_state=containment_state,
    )


@router.get(
    "/{incident_id}",
    response_model=IncidentDetail,
    responses={404: {"model": ErrorBody}},
)
def read_incident(incident_id: str, session: DbSession) -> IncidentDetail:
    return get_incident(session, incident_id)
