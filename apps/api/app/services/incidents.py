"""Incident queries. Containment and asset links are absent until those columns exist."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import not_found
from app.models.identity import User
from app.models.incident import Incident, IncidentEvidence, IncidentTask
from app.schemas.common import Page
from app.schemas.incidents import (
    IncidentDetail,
    IncidentEvidenceItem,
    IncidentIndicatorItem,
    IncidentListItem,
    IncidentTaskItem,
    TimelineEvent,
)
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
    incident = session.scalar(
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
    if incident is None:
        raise not_found("Incident", incident_id)
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
    )


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
