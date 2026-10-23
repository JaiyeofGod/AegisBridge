"""Incidents: reads and authenticated management updates."""

from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession, PageQuery, RequireCsrf, require_permissions
from app.schemas.common import ErrorBody, Page
from app.schemas.incidents import (
    IncidentDetail,
    IncidentListItem,
    IncidentTaskCreate,
    IncidentTaskRecord,
    IncidentTaskUpdate,
    IncidentUpdate,
)
from app.services.incident_tasks import (
    create_incident_task,
    get_incident_task,
    list_incident_tasks,
    update_incident_task,
)
from app.services.incidents import get_incident, list_incidents, update_incident

router = APIRouter(
    prefix="/incidents",
    tags=["incidents"],
    dependencies=[Depends(require_permissions("incident.read"))],
)


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


@router.patch(
    "/{incident_id}",
    response_model=IncidentDetail,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("incident.manage"))],
)
def patch_incident(
    incident_id: str,
    body: IncidentUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> IncidentDetail:
    """Update supported incident fields. Closing requires incident.close. CSRF required."""
    return update_incident(session, principal, incident_id, body)


@router.get(
    "/{incident_id}/tasks",
    response_model=Page[IncidentTaskRecord],
    responses={404: {"model": ErrorBody}, 422: {"model": ErrorBody}},
)
def read_incident_tasks(
    incident_id: str,
    session: DbSession,
    page: PageQuery,
    status: str | None = Query(
        default=None,
        description="Filter: open, in_progress, blocked, completed, or cancelled.",
    ),
) -> Page[IncidentTaskRecord]:
    """List response tasks for one incident. Public ids are TASK-NNNN."""
    return list_incident_tasks(session, incident_id, page, status=status)


@router.post(
    "/{incident_id}/tasks",
    response_model=IncidentTaskRecord,
    responses={404: {"model": ErrorBody}, 422: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("incident.manage"))],
)
def post_incident_task(
    incident_id: str,
    body: IncidentTaskCreate,
    session: DbSession,
    principal: RequireCsrf,
) -> IncidentTaskRecord:
    """Create a response task. Server assigns the human id. CSRF required.

    Completing a task does not close or otherwise change the incident.
    """
    return create_incident_task(session, principal, incident_id, body)


@router.get(
    "/{incident_id}/tasks/{task_id}",
    response_model=IncidentTaskRecord,
    responses={404: {"model": ErrorBody}},
)
def read_incident_task(
    incident_id: str,
    task_id: str,
    session: DbSession,
) -> IncidentTaskRecord:
    """Read one response task that belongs to this incident."""
    return get_incident_task(session, incident_id, task_id)


@router.patch(
    "/{incident_id}/tasks/{task_id}",
    response_model=IncidentTaskRecord,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("incident.manage"))],
)
def patch_incident_task(
    incident_id: str,
    task_id: str,
    body: IncidentTaskUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> IncidentTaskRecord:
    """Update a response task. CSRF required. Stale expected_updated_at returns 409.

    incident.close is not required. The parent incident status is unchanged.
    """
    return update_incident_task(session, principal, incident_id, task_id, body)
