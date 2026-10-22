"""Evidence metadata contracts. Object credentials and raw keys are never returned."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PersonRef

EvidenceClassification = Literal["simulated", "internal", "confidential", "restricted"]


class EvidenceObjectSummary(BaseModel):
    original_filename: str
    content_type: str | None
    size_bytes: int
    sha256: str
    stored_at: datetime
    storage_provider: str
    hash_source: str = "server_calculated_at_ingestion"


class EvidenceDetail(BaseModel):
    id: str
    title: str
    description: str | None
    version_label: str
    sha256: str | None
    size_bytes: int | None
    mime_type: str | None
    data_classification: str
    collected_at: datetime | None
    collected_by: PersonRef | None
    control_ids: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None
    object_stored: bool = False
    integrity_verified: bool = False
    original_filename: str | None = None
    stored_at: datetime | None = None
    storage_provider: str | None = None
    content_type: str | None = None
    hash_source: str | None = None
    semantics: str = (
        "Evidence metadata. File bytes are stored in private object storage when object_stored "
        "is true. A SHA-256 value calculated at ingestion is not an independent integrity "
        "re-verification. Malware scanning is not implemented in this phase."
    )


class EvidenceCreate(BaseModel):
    """Create evidence metadata without uploading a file."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=8000)
    version_label: str = Field(default="1", min_length=1, max_length=32)
    sha256: str | None = Field(
        default=None,
        description="Optional caller-supplied 64-hex digest before an object is uploaded.",
    )
    size_bytes: int | None = Field(default=None, ge=0)
    mime_type: str | None = Field(default=None, max_length=120)
    data_classification: EvidenceClassification = "simulated"
    collected_at: datetime | None = None
    collected_by: str | None = Field(
        default=None,
        description="Collector user human id. Defaults to the authenticated actor.",
    )


class EvidenceObjectDeleteResult(BaseModel):
    evidence_id: str
    object_stored: bool = False
    deleted: bool = True


class ControlEvidenceLinkResult(BaseModel):
    control_id: str
    evidence_id: str
    linked: bool
