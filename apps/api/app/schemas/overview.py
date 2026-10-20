"""Overview read model. Counts stay separate. There is no security score."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import PersonRef


class KevExposure(BaseModel):
    exposed_asset_count: int
    distinct_cve_count: int
    asset_ids: list[str]
    cve_ids: list[str]
    semantics: str


class ControlPosture(BaseModel):
    passed: int
    assessed_applicable: int
    semantics: str


class TelemetryPosture(BaseModel):
    active: int
    expected: int
    semantics: str


class WorkItem(BaseModel):
    id: str
    kind: str
    title: str
    status: str
    owner: PersonRef | None = None


class SummaryNote(BaseModel):
    id: str
    title: str
    detail: str


class OverviewResponse(BaseModel):
    generated_at: datetime
    organization_name: str | None
    data_origin: str | None
    environment_label: str | None
    kev_exposure: KevExposure
    open_incidents: int
    control_posture: ControlPosture
    telemetry: TelemetryPosture
    my_work: list[WorkItem]
    security_highlights: list[SummaryNote]
    executive_notes: list[SummaryNote]
