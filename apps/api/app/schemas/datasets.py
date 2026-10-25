"""Dataset registry and experiment contracts. File bytes are not returned."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import RelatedRecord


class DatasetListItem(BaseModel):
    id: str
    name: str
    description: str | None
    publisher: str | None
    source_label: str | None
    source_url: str | None
    publication_year: int | None
    domain: str | None
    license_label: str | None
    status: str
    verification_status: str | None
    purpose: str | None
    size_label: str | None
    row_count: int | None
    feature_count: int | None
    file_count: int
    version_count: int
    experiment_count: int
    created_at: datetime
    updated_at: datetime
    notes: str | None


class DatasetFileItem(BaseModel):
    filename: str
    sha256: str | None
    size_bytes: int | None
    has_storage_uri: bool


class DatasetVersionItem(BaseModel):
    version_label: str
    file_count: int
    experiment_count: int
    created_at: datetime
    source_revision: str | None = None
    ingestion_status: str | None = None
    validation_status: str | None = None
    ingested_at: datetime | None = None
    row_count: int | None = None
    column_count: int | None = None
    byte_size: int | None = None
    sha256: str | None = None
    label_counts: dict[str, int] | None = None
    derived: bool | None = None
    derivation_profile: str | None = None
    derivation_fingerprint: str | None = None
    derivation_type: str | None = None
    split_label_counts: dict[str, dict[str, int]] | None = None


class DatasetExperimentRef(BaseModel):
    id: str
    name: str
    status: str
    experiment_type: str | None


class DatasetDetail(DatasetListItem):
    versions: list[DatasetVersionItem]
    files: list[DatasetFileItem]
    experiments: list[DatasetExperimentRef]


class ExperimentListItem(BaseModel):
    id: str
    name: str
    status: str
    experiment_type: str | None
    approach: str | None
    metrics_summary: str | None
    started_at: datetime | None
    completed_at: datetime | None
    notes: str | None
    dataset: RelatedRecord


class ExperimentDetail(ExperimentListItem):
    dataset_version_label: str
