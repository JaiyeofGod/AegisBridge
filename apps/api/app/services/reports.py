"""Report definition reads. Counts do not invent generated files or job runs."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import not_found
from app.models.dataset import Dataset, DatasetExperiment
from app.models.report import ReportDefinition
from app.schemas.common import Page
from app.schemas.reports import ReportDefinitionDetail, ReportDefinitionListItem, ReportsSummary
from app.services.support import PageParams, like_pattern, page, paginate, person, require_choice

REPORT_STATUSES = frozenset({"draft", "ready", "review", "archived"})
SUMMARY_SEMANTICS = (
    "Report definitions are stored catalog rows. "
    "schedule_defined means a cadence label is stored; no report scheduler or worker is running. "
    "completed_report_count, failed_report_count, and recent_execution_count stay at zero "
    "because no report execution or export rows are stored. "
    "Datasets are registry metadata only unless files are stored."
)
QUALITY_REVIEW = frozenset({"verification_required", "quality_review"})


def get_summary(session: Session) -> ReportsSummary:
    definitions = int(session.scalar(select(func.count()).select_from(ReportDefinition)) or 0)
    scheduled = int(
        session.scalar(
            select(func.count())
            .select_from(ReportDefinition)
            .where(ReportDefinition.schedule_state == "schedule_defined")
        )
        or 0
    )
    datasets = int(session.scalar(select(func.count()).select_from(Dataset)) or 0)
    quality = int(
        session.scalar(
            select(func.count())
            .select_from(Dataset)
            .where(func.lower(Dataset.verification_status).in_(QUALITY_REVIEW))
        )
        or 0
    )
    experiments = int(session.scalar(select(func.count()).select_from(DatasetExperiment)) or 0)
    return ReportsSummary(
        report_definition_count=definitions,
        scheduled_report_count=scheduled,
        completed_report_count=0,
        failed_report_count=0,
        recent_execution_count=0,
        dataset_count=datasets,
        dataset_quality_review_count=quality,
        experiment_count=experiments,
        semantics=SUMMARY_SEMANTICS,
    )


def list_definitions(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    status: str | None = None,
    report_type: str | None = None,
) -> Page[ReportDefinitionListItem]:
    status = require_choice("status", status, REPORT_STATUSES)
    statement = (
        select(ReportDefinition)
        .options(selectinload(ReportDefinition.owner))
        .order_by(ReportDefinition.human_id)
    )
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                ReportDefinition.name.ilike(term, escape="\\"),
                ReportDefinition.human_id.ilike(term, escape="\\"),
                ReportDefinition.description.ilike(term, escape="\\"),
                ReportDefinition.report_type.ilike(term, escape="\\"),
            )
        )
    if status:
        statement = statement.where(ReportDefinition.status == status)
    if report_type:
        token = report_type.strip().lower()
        statement = statement.where(func.lower(ReportDefinition.report_type) == token)
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_definition(row) for row in rows])


def get_definition(session: Session, report_id: str) -> ReportDefinitionDetail:
    row = session.scalar(
        select(ReportDefinition)
        .where(ReportDefinition.human_id == report_id)
        .options(selectinload(ReportDefinition.owner))
    )
    if row is None:
        raise not_found("Report definition", report_id)
    base = _definition(row)
    return ReportDefinitionDetail(**base.model_dump(), generated_files=[])


def _definition(row: ReportDefinition) -> ReportDefinitionListItem:
    return ReportDefinitionListItem(
        id=row.human_id,
        name=row.name,
        description=row.description,
        report_type=row.report_type,
        status=row.status,
        schedule_state=row.schedule_state,
        schedule_label=row.schedule_label,
        format_label=row.format_label,
        owner=person(row.owner),
        created_at=row.created_at,
        updated_at=row.updated_at,
        last_run_at=row.last_run_at,
        next_run_at=row.next_run_at,
    )
