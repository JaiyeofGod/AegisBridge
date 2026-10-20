"""Report definition contracts. Generated files are not part of these shapes."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import PersonRef


class ReportsSummary(BaseModel):
    report_definition_count: int
    scheduled_report_count: int
    completed_report_count: int
    failed_report_count: int
    recent_execution_count: int
    dataset_count: int
    dataset_quality_review_count: int
    experiment_count: int
    semantics: str


class ReportDefinitionListItem(BaseModel):
    id: str
    name: str
    description: str
    report_type: str
    status: str
    schedule_state: str
    schedule_label: str | None
    format_label: str | None
    owner: PersonRef | None
    created_at: datetime
    updated_at: datetime
    last_run_at: datetime | None
    next_run_at: datetime | None


class ReportDefinitionDetail(ReportDefinitionListItem):
    generated_files: list[str]
