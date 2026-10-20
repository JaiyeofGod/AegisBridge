"""Administration contracts. Credential material is not part of this response."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import PersonRef


class AdministrationSummary(BaseModel):
    configured_integration_count: int
    integration_status: dict[str, int]
    integration_freshness: dict[str, int]
    active_user_count: int
    privileged_user_count: int
    recent_audit_event_count: int
    pending_access_review_count: int
    privileged_roles: list[str]
    semantics: str


class IntegrationListItem(BaseModel):
    id: str
    name: str
    provider: str
    status: str
    freshness: str | None
    last_sync_at: datetime | None
    last_success_at: datetime | None
    credential_state: str
    notes: str | None


class UserListItem(BaseModel):
    id: str
    display_name: str
    email: str
    status: str
    department: str | None
    roles: list[str]
    privileged: bool


class RoleListItem(BaseModel):
    id: str
    name: str
    summary: str
    permissions: list[str]


class AuditEventItem(BaseModel):
    id: str
    occurred_at: datetime
    actor: PersonRef | None
    actor_label: str
    action: str
    object_type: str
    object_id: str
    result: str
    source: str
    environment_name: str
    detail: str | None


class AccessReviewItem(BaseModel):
    id: str
    name: str
    status: str
    owner: PersonRef | None
    open_finding_count: int
    total_finding_count: int
    due_at: datetime | None
