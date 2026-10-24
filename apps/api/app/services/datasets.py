"""Dataset registry and experiment reads. Storage URIs and credentials are omitted."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import not_found
from app.models.dataset import Dataset, DatasetExperiment, DatasetVersion
from app.schemas.common import Page, RelatedRecord
from app.schemas.datasets import (
    DatasetDetail,
    DatasetExperimentRef,
    DatasetFileItem,
    DatasetListItem,
    DatasetVersionItem,
    ExperimentDetail,
    ExperimentListItem,
)
from app.services.support import PageParams, like_pattern, page, paginate, require_choice

DATASET_STATUSES = frozenset(
    {
        "candidate",
        "registry_only",
        "not_downloaded",
        "downloading",
        "validating",
        "ready",
        "failed",
        "reviewed",
        "approved",
        "rejected",
        "archived",
    }
)
VERIFICATION_STATUSES = frozenset(
    {
        "not_reviewed",
        "verification_required",
        "quality_review",
        "reviewed",
        "approved",
        "rejected",
    }
)
EXPERIMENT_STATUSES = frozenset({"planned", "running", "completed", "failed", "cancelled"})


def list_datasets(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    status: str | None = None,
    domain: str | None = None,
    verification_status: str | None = None,
    publication_year: int | None = None,
) -> Page[DatasetListItem]:
    status = require_choice("status", status, DATASET_STATUSES)
    verification_status = require_choice(
        "verification_status", verification_status, VERIFICATION_STATUSES
    )
    statement = (
        select(Dataset)
        .options(
            selectinload(Dataset.versions).selectinload(DatasetVersion.files),
            selectinload(Dataset.versions).selectinload(DatasetVersion.experiments),
        )
        .order_by(Dataset.human_id)
    )
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                Dataset.name.ilike(term, escape="\\"),
                Dataset.human_id.ilike(term, escape="\\"),
                Dataset.description.ilike(term, escape="\\"),
                Dataset.domain.ilike(term, escape="\\"),
                Dataset.publisher.ilike(term, escape="\\"),
            )
        )
    if status:
        statement = statement.where(Dataset.status == status)
    if domain:
        token = domain.strip().lower()
        statement = statement.where(func.lower(Dataset.domain) == token)
    if verification_status:
        statement = statement.where(Dataset.verification_status == verification_status)
    if publication_year is not None:
        statement = statement.where(Dataset.publication_year == publication_year)
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_dataset(row) for row in rows])


def get_dataset(session: Session, dataset_id: str) -> DatasetDetail:
    row = session.scalar(
        select(Dataset)
        .where(Dataset.human_id == dataset_id)
        .options(
            selectinload(Dataset.versions).selectinload(DatasetVersion.files),
            selectinload(Dataset.versions).selectinload(DatasetVersion.experiments),
        )
    )
    if row is None:
        raise not_found("Dataset", dataset_id)
    base = _dataset(row)
    files = [
        DatasetFileItem(
            filename=file.filename,
            sha256=file.sha256,
            size_bytes=file.size_bytes,
            has_storage_uri=file.storage_uri is not None,
        )
        for version in row.versions
        for file in version.files
    ]
    experiments = [
        DatasetExperimentRef(
            id=experiment.human_id or experiment.name,
            name=experiment.name,
            status=experiment.status,
            experiment_type=experiment.experiment_type,
        )
        for version in row.versions
        for experiment in version.experiments
    ]
    versions = [
        DatasetVersionItem(
            version_label=version.version_label,
            file_count=len(version.files),
            experiment_count=len(version.experiments),
            created_at=version.created_at,
            source_revision=version.source_revision,
            ingestion_status=version.ingestion_status,
            validation_status=version.validation_status,
            ingested_at=version.ingested_at,
            row_count=version.row_count,
            column_count=version.column_count,
            byte_size=version.byte_size,
            sha256=version.artifact_sha256,
            label_counts=_label_counts(version.profile),
        )
        for version in sorted(row.versions, key=lambda item: item.version_label)
    ]
    return DatasetDetail(
        **base.model_dump(),
        versions=versions,
        files=files,
        experiments=experiments,
    )


def list_experiments(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    status: str | None = None,
    dataset_id: str | None = None,
    experiment_type: str | None = None,
) -> Page[ExperimentListItem]:
    status = require_choice("status", status, EXPERIMENT_STATUSES)
    statement = (
        select(DatasetExperiment)
        .options(
            selectinload(DatasetExperiment.dataset_version).selectinload(DatasetVersion.dataset)
        )
        .order_by(DatasetExperiment.human_id.nulls_last(), DatasetExperiment.name)
    )
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                DatasetExperiment.name.ilike(term, escape="\\"),
                DatasetExperiment.human_id.ilike(term, escape="\\"),
                DatasetExperiment.notes.ilike(term, escape="\\"),
                DatasetExperiment.metrics_summary.ilike(term, escape="\\"),
            )
        )
    if status:
        statement = statement.where(DatasetExperiment.status == status)
    if experiment_type:
        token = experiment_type.strip().lower()
        statement = statement.where(func.lower(DatasetExperiment.experiment_type) == token)
    if dataset_id:
        token = dataset_id.strip()
        statement = statement.where(
            DatasetExperiment.dataset_version.has(
                DatasetVersion.dataset.has(Dataset.human_id == token)
            )
        )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_experiment(row) for row in rows])


def get_experiment(session: Session, experiment_id: str) -> ExperimentDetail:
    row = session.scalar(
        select(DatasetExperiment)
        .where(DatasetExperiment.human_id == experiment_id)
        .options(
            selectinload(DatasetExperiment.dataset_version).selectinload(DatasetVersion.dataset)
        )
    )
    if row is None:
        raise not_found("Dataset experiment", experiment_id)
    base = _experiment(row)
    return ExperimentDetail(
        **base.model_dump(),
        dataset_version_label=row.dataset_version.version_label,
    )


def _label_counts(profile: dict[str, object] | None) -> dict[str, int] | None:
    if not profile or profile.get("label_count_scope") != "full":
        return None
    counts = profile.get("label_counts")
    if not isinstance(counts, dict):
        return None
    parsed: dict[str, int] = {}
    for key, value in counts.items():
        if isinstance(key, str) and isinstance(value, int) and not isinstance(value, bool):
            parsed[key] = value
    return parsed or None


def _dataset(row: Dataset) -> DatasetListItem:
    file_count = sum(len(version.files) for version in row.versions)
    experiment_count = sum(len(version.experiments) for version in row.versions)
    return DatasetListItem(
        id=row.human_id,
        name=row.name,
        description=row.description,
        publisher=row.publisher,
        source_label=row.source_label,
        source_url=row.source_url,
        publication_year=row.publication_year,
        domain=row.domain,
        license_label=row.license_label,
        status=row.status,
        verification_status=row.verification_status,
        purpose=row.purpose,
        size_label=row.size_label,
        row_count=row.row_count,
        feature_count=row.feature_count,
        file_count=file_count,
        version_count=len(row.versions),
        experiment_count=experiment_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
        notes=row.notes,
    )


def _experiment(row: DatasetExperiment) -> ExperimentListItem:
    dataset = row.dataset_version.dataset
    return ExperimentListItem(
        id=row.human_id or row.name,
        name=row.name,
        status=row.status,
        experiment_type=row.experiment_type,
        approach=row.approach,
        metrics_summary=row.metrics_summary,
        started_at=row.started_at,
        completed_at=row.completed_at,
        notes=row.notes,
        dataset=RelatedRecord(
            id=dataset.human_id,
            title=dataset.name,
            status=dataset.status,
            summary=dataset.notes,
        ),
    )
