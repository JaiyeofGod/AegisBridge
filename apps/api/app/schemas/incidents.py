"""Incident contract. Severity and status stay separate from a compromise verdict."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import PersonRef, RelatedRecord


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
    title: str
    status: str
    assignee: PersonRef | None = None


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
