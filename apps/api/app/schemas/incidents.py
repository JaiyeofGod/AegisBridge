"""Incident contract. Severity and status stay separate from a compromise verdict."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PersonRef, RelatedRecord

IncidentSeverity = Literal["critical", "high", "medium", "low", "informational"]
IncidentStatus = Literal[
    "new",
    "investigating",
    "contained",
    "mitigated",
    "resolved",
    "closed",
]

CLOSED_STATUSES = frozenset({"resolved", "closed"})
IncidentTaskStatus = Literal["open", "in_progress", "blocked", "completed", "cancelled"]
ACTIVE_TASK_STATUSES = frozenset({"open", "in_progress", "blocked"})
TERMINAL_TASK_STATUSES = frozenset({"completed", "cancelled"})


class IncidentListItem(BaseModel):
    id: str
    title: str
    severity: str
    status: str
    containment_state: str | None
    summary: str
    owner: PersonRef | None = None
    open_task_count: int
    evidence_count: int


class TimelineEvent(BaseModel):
    occurred_at: datetime
    summary: str


class IncidentTaskItem(BaseModel):
    id: str
    title: str
    status: str
    assignee: PersonRef | None = None


class IncidentTaskRecord(BaseModel):
    """Public incident task. Internal UUIDs stay off this contract."""

    id: str
    incident_id: str
    title: str
    status: str
    assignee: PersonRef | None = None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class IncidentTaskCreate(BaseModel):
    """Create a response task. The server assigns TASK-NNNN."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    status: IncidentTaskStatus = "open"
    assignee: str | None = Field(
        default=None,
        description="Assignee user human id, such as USR-0004. Null leaves the task unassigned.",
    )


class IncidentTaskUpdate(BaseModel):
    """Partial task patch. completed_at is server-owned."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: IncidentTaskStatus | None = None
    assignee: str | None = Field(
        default=None,
        description="Assignee user human id. Null clears the assignee.",
    )
    expected_updated_at: datetime | None = None


class IncidentIndicatorItem(BaseModel):
    kind: str
    value: str
    confidence: str


class IncidentEvidenceItem(BaseModel):
    id: str
    title: str
    sha256: str | None
    collected_at: datetime | None
    note: str | None


class IncidentDetail(IncidentListItem):
    timeline: list[TimelineEvent]
    tasks: list[IncidentTaskItem]
    indicators: list[IncidentIndicatorItem]
    evidence: list[IncidentEvidenceItem]
    related_alerts: list[RelatedRecord]
    affected_assets: list[RelatedRecord]
    updated_at: datetime | None = None


class IncidentUpdate(BaseModel):
    """Partial incident patch. Only Incident columns are writable here."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    severity: IncidentSeverity | None = None
    status: IncidentStatus | None = None
    summary: str | None = Field(default=None, min_length=1, max_length=8000)
    owner: str | None = Field(
        default=None,
        description="Owner user human id (e.g. USR-0004). Null clears the owner.",
    )
    expected_updated_at: datetime | None = None
