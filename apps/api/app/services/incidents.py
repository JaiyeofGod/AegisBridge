"""Incident queries and updates. Containment/asset links are absent until columns exist."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import ApiError, not_found
from app.core.config import get_settings
from app.models.identity import User
from app.models.incident import Incident, IncidentEvidence, IncidentTask
from app.schemas.common import Page
from app.schemas.incidents import (
    CLOSED_STATUSES,
    IncidentDetail,
    IncidentEvidenceItem,
    IncidentIndicatorItem,
    IncidentListItem,
    IncidentTaskItem,
    IncidentUpdate,
    TimelineEvent,
)
from app.security.rbac import AuthenticatedPrincipal
from app.services.audit_write import record_audit_event
from app.services.support import CLOSED_INCIDENT, PageParams, like_pattern, page, paginate, person


def list_incidents(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    owner: str | None = None,
    containment_state: str | None = None,
) -> Page[IncidentListItem]:
    if containment_state is not None and containment_state.strip() != "":
        return page(page_params, 0, [])
    statement = (
        select(Incident)
        .options(
            selectinload(Incident.owner),
            selectinload(Incident.tasks),
            selectinload(Incident.evidence_links),
        )
        .order_by(Incident.human_id)
    )
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                Incident.title.ilike(term, escape="\\"),
                Incident.human_id.ilike(term, escape="\\"),
                Incident.summary.ilike(term, escape="\\"),
            )
        )
    if severity:
        statement = statement.where(func.lower(Incident.severity) == severity.strip().lower())
    if status:
        statement = statement.where(func.lower(Incident.status) == status.strip().lower())
    if owner:
        term = like_pattern(owner.strip())
        statement = statement.where(
            Incident.owner.has(
                or_(
                    User.display_name.ilike(term, escape="\\"),
                    User.human_id.ilike(term, escape="\\"),
                )
            )
        )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_list_item(row) for row in rows])


def get_incident(session: Session, incident_id: str) -> IncidentDetail:
    incident = _load_incident(session, incident_id, for_update=False)
    return _detail(incident)


def update_incident(
    session: Session,
    principal: AuthenticatedPrincipal,
    incident_id: str,
    patch: IncidentUpdate,
) -> IncidentDetail:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    if not payload:
        raise ApiError(422, "validation_error", "At least one incident field is required.")

    incident = _load_incident(session, incident_id, for_update=True)
    if expected is not None:
        _assert_fresh(
            incident.updated_at,
            expected,
            "The incident was modified by another request.",
        )

    if (
        "status" in payload
        and payload["status"] in CLOSED_STATUSES
        and not principal.has_permission("incident.close")
    ):
        raise ApiError(403, "forbidden", "You do not have access to this resource.")

    changed: list[str] = []
    if "title" in payload and incident.title != payload["title"]:
        incident.title = payload["title"]
        changed.append("title")
    if "severity" in payload and incident.severity != payload["severity"]:
        incident.severity = payload["severity"]
        changed.append("severity")
    if "status" in payload and incident.status != payload["status"]:
        incident.status = payload["status"]
        changed.append("status")
    if "summary" in payload and incident.summary != payload["summary"]:
        incident.summary = payload["summary"]
        changed.append("summary")
    if "owner" in payload:
        new_owner_id = _resolve_owner_id(session, payload["owner"])
        if incident.owner_user_id != new_owner_id:
            incident.owner_user_id = new_owner_id
            changed.append("owner")

    incident.updated_at = datetime.now(UTC)
    settings = get_settings()
    record_audit_event(
        session,
        organization_id=incident.organization_id,
        action="INCIDENT_UPDATE",
        object_type="incident",
        object_id=incident.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Updated incident fields: {', '.join(changed) if changed else 'none'}.",
    )
    session.commit()
    return get_incident(session, incident_id)


def _load_incident(session: Session, incident_id: str, *, for_update: bool) -> Incident:
    statement = (
        select(Incident)
        .where(Incident.human_id == incident_id)
        .options(
            selectinload(Incident.owner),
            selectinload(Incident.events),
            selectinload(Incident.tasks).selectinload(IncidentTask.assignee),
            selectinload(Incident.indicators),
            selectinload(Incident.evidence_links).selectinload(IncidentEvidence.evidence),
        )
    )
    if for_update:
        statement = statement.with_for_update()
    incident = session.scalar(statement)
    if incident is None:
        raise not_found("Incident", incident_id)
    return incident


def _detail(incident: Incident) -> IncidentDetail:
    item = _list_item(incident)
    return IncidentDetail(
        **item.model_dump(),
        timeline=[
            TimelineEvent(occurred_at=event.occurred_at, summary=event.summary)
            for event in sorted(incident.events, key=lambda event: event.occurred_at)
        ],
        tasks=[
            IncidentTaskItem(
                title=task.title,
                status=task.status,
                assignee=person(task.assignee),
            )
            for task in incident.tasks
        ],
        indicators=[
            IncidentIndicatorItem(
                kind=indicator.kind,
                value=indicator.value,
                confidence=indicator.confidence,
            )
            for indicator in incident.indicators
        ],
        evidence=[
            IncidentEvidenceItem(
                id=link.evidence.human_id,
                title=link.evidence.title,
                sha256=link.evidence.sha256,
                collected_at=link.evidence.collected_at,
                note=link.note,
            )
            for link in incident.evidence_links
        ],
        related_alerts=[],
        affected_assets=[],
        updated_at=incident.updated_at,
    )


def _resolve_owner_id(session: Session, owner_human_id: str | None):
    if owner_human_id is None:
        return None
    user = session.scalar(select(User).where(User.human_id == owner_human_id.strip()))
    if user is None:
        raise ApiError(422, "validation_error", "Owner user was not found.")
    return user.id


def _assert_fresh(current: datetime, expected: datetime, message: str) -> None:
    left = current if current.tzinfo is not None else current.replace(tzinfo=UTC)
    right = expected if expected.tzinfo is not None else expected.replace(tzinfo=UTC)
    if left != right:
        raise ApiError(409, "conflict", message)


def _list_item(incident: Incident) -> IncidentListItem:
    open_tasks = sum(1 for task in incident.tasks if task.status.lower() not in CLOSED_INCIDENT)
    return IncidentListItem(
        id=incident.human_id,
        title=incident.title,
        severity=incident.severity,
        status=incident.status,
        containment_state=None,
        summary=incident.summary,
        owner=person(incident.owner),
        open_task_count=open_tasks,
        evidence_count=len(incident.evidence_links),
    )
