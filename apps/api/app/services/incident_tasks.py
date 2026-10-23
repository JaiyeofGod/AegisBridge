"""Incident response tasks. Completion does not change the parent incident."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import case, select, text
from sqlalchemy.orm import Session, selectinload

from app.api.errors import ApiError, not_found
from app.core.config import get_settings
from app.models.identity import User
from app.models.incident import Incident, IncidentTask
from app.schemas.common import Page
from app.schemas.incidents import (
    ACTIVE_TASK_STATUSES,
    IncidentTaskCreate,
    IncidentTaskRecord,
    IncidentTaskStatus,
    IncidentTaskUpdate,
)
from app.security.rbac import AuthenticatedPrincipal
from app.services.audit_write import record_audit_event
from app.services.support import PageParams, next_human_id, page, paginate, person

_STATUS_ACTIONS = {
    "completed": "INCIDENT_TASK_COMPLETE",
    "cancelled": "INCIDENT_TASK_CANCEL",
}
# Transaction-scoped PostgreSQL lock. Not shared with other human-id allocators.
_TASK_HUMAN_ID_LOCK = 814_202_013


def list_incident_tasks(
    session: Session,
    incident_id: str,
    page_params: PageParams,
    *,
    status: str | None = None,
) -> Page[IncidentTaskRecord]:
    incident = _incident_by_human_id(session, incident_id)
    statement = (
        select(IncidentTask)
        .where(IncidentTask.incident_id == incident.id)
        .options(selectinload(IncidentTask.assignee))
        .order_by(_incomplete_first(), IncidentTask.human_id)
    )
    if status is not None and status.strip():
        normalized = _require_status(status)
        statement = statement.where(IncidentTask.status == normalized)
    total, rows = paginate(session, statement, page_params)
    return page(
        page_params,
        total,
        [_record(incident.human_id, row) for row in rows],
    )


def get_incident_task(session: Session, incident_id: str, task_id: str) -> IncidentTaskRecord:
    incident = _incident_by_human_id(session, incident_id)
    task = _task_for_incident(session, incident, task_id, for_update=False)
    return _record(incident.human_id, task)


def create_incident_task(
    session: Session,
    principal: AuthenticatedPrincipal,
    incident_id: str,
    body: IncidentTaskCreate,
) -> IncidentTaskRecord:
    incident = _incident_by_human_id(session, incident_id)
    title = _clean_title(body.title)
    assignee_id = _resolve_assignee_id(session, incident, body.assignee)
    now = datetime.now(UTC)
    task = IncidentTask(
        incident_id=incident.id,
        assignee_user_id=assignee_id,
        human_id=_allocate_task_human_id(session),
        title=title,
        status=body.status,
        completed_at=now if body.status == "completed" else None,
    )
    session.add(task)
    session.flush()
    _audit(
        session,
        principal,
        incident,
        task,
        action=_STATUS_ACTIONS.get(body.status, "INCIDENT_TASK_CREATE"),
        changed=["title", "status", *(["assignee"] if assignee_id is not None else [])],
        old_status=None,
        new_status=body.status,
        assignee_human_id=body.assignee,
    )
    session.commit()
    return get_incident_task(session, incident.human_id, task.human_id)


def update_incident_task(
    session: Session,
    principal: AuthenticatedPrincipal,
    incident_id: str,
    task_id: str,
    patch: IncidentTaskUpdate,
) -> IncidentTaskRecord:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    if not payload:
        raise ApiError(422, "validation_error", "At least one task field is required.")

    incident = _incident_by_human_id(session, incident_id)
    task = _task_for_incident(session, incident, task_id, for_update=True)
    if expected is not None:
        _assert_fresh(task.updated_at, expected)

    changed: list[str] = []
    old_status = task.status
    assignee_label = None if task.assignee is None else task.assignee.human_id
    if "title" in payload:
        title = _clean_title(payload["title"])
        if task.title != title:
            task.title = title
            changed.append("title")
    if "assignee" in payload:
        new_assignee_id = _resolve_assignee_id(session, incident, payload["assignee"])
        if task.assignee_user_id != new_assignee_id:
            task.assignee_user_id = new_assignee_id
            assignee_label = payload["assignee"].strip() if payload["assignee"] else None
            changed.append("assignee")
    action = "INCIDENT_TASK_UPDATE"
    if "status" in payload and task.status != payload["status"]:
        action = _apply_status(task, payload["status"])
        changed.append("status")

    task.updated_at = datetime.now(UTC)
    _audit(
        session,
        principal,
        incident,
        task,
        action=action,
        changed=changed,
        old_status=old_status,
        new_status=task.status,
        assignee_human_id=assignee_label,
    )
    session.commit()
    return get_incident_task(session, incident.human_id, task.human_id)


def _allocate_task_human_id(session: Session) -> str:
    """Reserve the next TASK-NNNN inside the caller's transaction.

    ``pg_advisory_xact_lock`` blocks other task creates until this transaction
    commits or rolls back, so the following max+1 read sees their inserts.
    """
    session.execute(
        text("SELECT pg_advisory_xact_lock(CAST(:key AS bigint))"),
        {"key": _TASK_HUMAN_ID_LOCK},
    )
    return next_human_id(session, IncidentTask.human_id, "TASK")


def _apply_status(task: IncidentTask, new_status: IncidentTaskStatus) -> str:
    previous = task.status
    task.status = new_status
    now = datetime.now(UTC)
    if new_status == "completed":
        task.completed_at = now
        return "INCIDENT_TASK_COMPLETE"
    if new_status == "cancelled":
        task.completed_at = None
        return "INCIDENT_TASK_CANCEL"
    if previous in {"completed", "cancelled"} and new_status in ACTIVE_TASK_STATUSES:
        task.completed_at = None
        return "INCIDENT_TASK_REOPEN"
    task.completed_at = None
    return "INCIDENT_TASK_UPDATE"


def _audit(
    session: Session,
    principal: AuthenticatedPrincipal,
    incident: Incident,
    task: IncidentTask,
    *,
    action: str,
    changed: list[str],
    old_status: str | None,
    new_status: str,
    assignee_human_id: str | None,
) -> None:
    fields = ", ".join(changed) if changed else "none"
    if old_status in {None, new_status}:
        status_change = "unchanged"
    else:
        status_change = f"{old_status} -> {new_status}"
    assignee = assignee_human_id or "unassigned"
    record_audit_event(
        session,
        organization_id=incident.organization_id,
        action=action,
        object_type="incident_task",
        object_id=f"{incident.human_id}:{task.human_id}",
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=get_settings().app_env,
        detail=(
            f"Incident {incident.human_id} task {task.human_id}. "
            f"Fields: {fields}. Status: {status_change}. Assignee: {assignee}."
        ),
    )


def _incident_by_human_id(session: Session, incident_id: str) -> Incident:
    incident = session.scalar(select(Incident).where(Incident.human_id == incident_id))
    if incident is None:
        raise not_found("Incident", incident_id)
    return incident


def _task_for_incident(
    session: Session,
    incident: Incident,
    task_id: str,
    *,
    for_update: bool,
) -> IncidentTask:
    statement = (
        select(IncidentTask)
        .where(
            IncidentTask.incident_id == incident.id,
            IncidentTask.human_id == task_id,
        )
        .options(selectinload(IncidentTask.assignee))
    )
    if for_update:
        statement = statement.with_for_update()
    task = session.scalar(statement)
    if task is None:
        raise not_found("Incident task", task_id)
    return task


def _resolve_assignee_id(
    session: Session,
    incident: Incident,
    assignee_human_id: str | None,
):
    if assignee_human_id is None:
        return None
    cleaned = assignee_human_id.strip()
    if not cleaned:
        raise ApiError(422, "validation_error", "Assignee user was not found.")
    user = session.scalar(select(User).where(User.human_id == cleaned))
    if user is None or user.organization_id != incident.organization_id:
        raise ApiError(422, "validation_error", "Assignee user was not found.")
    if user.account_status.lower() != "active":
        raise ApiError(422, "validation_error", "Assignee must be an active user.")
    return user.id


def _require_status(value: str) -> IncidentTaskStatus:
    allowed: dict[str, IncidentTaskStatus] = {
        "open": "open",
        "in_progress": "in_progress",
        "blocked": "blocked",
        "completed": "completed",
        "cancelled": "cancelled",
    }
    found = allowed.get(value.strip().lower())
    if found is None:
        raise ApiError(422, "validation_error", "Task status is not supported.")
    return found


def _clean_title(value: str) -> str:
    title = value.strip()
    if not title:
        raise ApiError(422, "validation_error", "Title is required.")
    return title


def _assert_fresh(current: datetime, expected: datetime) -> None:
    left = current if current.tzinfo is not None else current.replace(tzinfo=UTC)
    right = expected if expected.tzinfo is not None else expected.replace(tzinfo=UTC)
    if left != right:
        raise ApiError(409, "conflict", "The incident task was modified by another request.")


def _incomplete_first():
    return case(
        (IncidentTask.status.in_(tuple(ACTIVE_TASK_STATUSES)), 0),
        else_=1,
    )


def _record(incident_human_id: str, task: IncidentTask) -> IncidentTaskRecord:
    return IncidentTaskRecord(
        id=task.human_id,
        incident_id=incident_human_id,
        title=task.title,
        status=task.status,
        assignee=person(task.assignee),
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
