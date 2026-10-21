"""Append-only audit writers. Never store passwords, tokens, or digests."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models.audit import AuditEvent


def record_audit_event(
    session: Session,
    *,
    organization_id: UUID,
    action: str,
    object_type: str,
    object_id: str,
    result: str,
    actor_user_id: UUID | None,
    actor_label: str,
    source: str = "api",
    environment_name: str = "local",
    detail: str | None = None,
) -> AuditEvent:
    event = AuditEvent(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        human_id=f"AUD-{uuid4().hex[:12].upper()}",
        actor_label=actor_label,
        action=action,
        object_type=object_type,
        object_id=object_id,
        result=result,
        source=source,
        environment_name=environment_name,
        detail=detail,
    )
    session.add(event)
    return event
