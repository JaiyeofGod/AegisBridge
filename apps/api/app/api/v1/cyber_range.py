"""Cyber-range catalog. Relationship writes document architecture only.

They do not discover networks, execute scenarios, or control the lab.
"""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, PageQuery, RequireCsrf, require_permissions
from app.schemas.common import ErrorBody, Page
from app.schemas.cyber_range import (
    CyberRangeSummary,
    LabDetectionItem,
    LabScenarioDetail,
    LabScenarioListItem,
    LabSystemDetail,
    LabSystemListItem,
    LabSystemRelationshipItem,
    LabSystemRelationshipWrite,
    LabTelemetryItem,
    LabZoneItem,
)
from app.services import cyber_range as service

router = APIRouter(
    prefix="/cyber-range",
    tags=["cyber-range"],
    dependencies=[Depends(require_permissions("cyber_range.read"))],
)


@router.get("/summary", response_model=CyberRangeSummary)
def read_summary(session: DbSession) -> CyberRangeSummary:
    return service.get_summary(session)


@router.get("/zones", response_model=Page[LabZoneItem])
def read_zones(session: DbSession, page: PageQuery) -> Page[LabZoneItem]:
    return service.list_zones(session, page)


@router.get("/systems", response_model=Page[LabSystemListItem])
def read_systems(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    zone: str | None = None,
    role: str | None = None,
    telemetry_status: str | None = None,
    observed_state: str | None = None,
) -> Page[LabSystemListItem]:
    return service.list_systems(
        session,
        page,
        search=search,
        zone=zone,
        role=role,
        telemetry_status=telemetry_status,
        observed_state=observed_state,
    )


@router.get("/system-relationships", response_model=Page[LabSystemRelationshipItem])
def read_system_relationships(
    session: DbSession, page: PageQuery
) -> Page[LabSystemRelationshipItem]:
    return service.list_system_relationships(session, page)


@router.post(
    "/system-relationships",
    response_model=LabSystemRelationshipItem,
    responses={
        403: {"model": ErrorBody},
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("cyber_range.manage"))],
)
def create_system_relationship(
    body: LabSystemRelationshipWrite,
    session: DbSession,
    principal: RequireCsrf,
) -> LabSystemRelationshipItem:
    """Store one documented catalog relationship. CSRF required."""
    return service.create_system_relationship(session, principal, body)


@router.patch(
    "/system-relationships/{relationship_id}",
    response_model=LabSystemRelationshipItem,
    responses={
        403: {"model": ErrorBody},
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("cyber_range.manage"))],
)
def update_system_relationship(
    relationship_id: str,
    body: LabSystemRelationshipWrite,
    session: DbSession,
    principal: RequireCsrf,
) -> LabSystemRelationshipItem:
    """Replace the stored source, target, and kind. CSRF required."""
    return service.update_system_relationship(session, principal, relationship_id, body)


@router.delete(
    "/system-relationships/{relationship_id}",
    response_model=LabSystemRelationshipItem,
    responses={403: {"model": ErrorBody}, 404: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("cyber_range.manage"))],
)
def delete_system_relationship(
    relationship_id: str,
    session: DbSession,
    principal: RequireCsrf,
) -> LabSystemRelationshipItem:
    """Remove one catalog relationship. Systems stay. CSRF required."""
    return service.delete_system_relationship(session, principal, relationship_id)


@router.get(
    "/systems/{system_id}",
    response_model=LabSystemDetail,
    responses={404: {"model": ErrorBody}},
)
def read_system(system_id: str, session: DbSession) -> LabSystemDetail:
    return service.get_system(session, system_id)


@router.get("/scenarios", response_model=Page[LabScenarioListItem])
def read_scenarios(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    status: str | None = None,
    category: str | None = None,
    attack_technique: str | None = None,
) -> Page[LabScenarioListItem]:
    return service.list_scenarios(
        session,
        page,
        search=search,
        status=status,
        category=category,
        attack_technique=attack_technique,
    )


@router.get(
    "/scenarios/{scenario_id}",
    response_model=LabScenarioDetail,
    responses={404: {"model": ErrorBody}},
)
def read_scenario(scenario_id: str, session: DbSession) -> LabScenarioDetail:
    return service.get_scenario(session, scenario_id)


@router.get("/telemetry", response_model=Page[LabTelemetryItem])
def read_telemetry(session: DbSession, page: PageQuery) -> Page[LabTelemetryItem]:
    return service.list_telemetry(session, page)


@router.get("/detections", response_model=Page[LabDetectionItem])
def read_detections(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    validation_state: str | None = None,
    attack_technique: str | None = None,
    data_source: str | None = None,
) -> Page[LabDetectionItem]:
    return service.list_detections(
        session,
        page,
        search=search,
        validation_state=validation_state,
        attack_technique=attack_technique,
        data_source=data_source,
    )
