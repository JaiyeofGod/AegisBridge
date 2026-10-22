"""Evidence metadata contracts. Object URIs and file bytes are never returned."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PersonRef

EvidenceClassification = Literal["simulated", "internal", "confidential", "restricted"]


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
    semantics: str = (
        "Metadata only. File bytes are not stored in the API. "
        "A SHA-256 value is caller-supplied metadata and is not verified against object storage."
    )


class EvidenceCreate(BaseModel):
    """Create evidence metadata without uploading a file."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=8000)
    version_label: str = Field(default="1", min_length=1, max_length=32)
    sha256: str | None = Field(
        default=None,
        description="Optional 64-character hex digest. Not computed by the API in this slice.",
    )
    size_bytes: int | None = Field(default=None, ge=0)
    mime_type: str | None = Field(default=None, max_length=120)
    data_classification: EvidenceClassification = "simulated"
    collected_at: datetime | None = None
    collected_by: str | None = Field(
        default=None,
        description="Collector user human id. Defaults to the authenticated actor.",
    )


class ControlEvidenceLinkResult(BaseModel):
    control_id: str
    evidence_id: str
    linked: bool
