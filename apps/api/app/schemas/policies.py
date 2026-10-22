"""Policy management contracts. Internal UUIDs and approval secrets are never returned."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PersonRef

PolicyLifecycleStatus = Literal["draft", "in_review", "approved", "published", "retired"]
PolicyVersionStatus = Literal["draft", "published", "superseded"]

POLICY_SEMANTICS = (
    "Policy metadata and versioned plain-text summaries. Published versions are immutable "
    "historical records. External e-signature, email notification, and document generation "
    "are not implemented. Policy↔control mappings are not stored in this schema revision."
)


class PolicyVersionSummary(BaseModel):
    version_label: str
    status: PolicyVersionStatus
    is_current: bool
    change_summary: str | None = None
    acknowledgement_count: int = 0
    updated_at: datetime | None = None


class PolicyVersionDetail(BaseModel):
    policy_id: str
    version_label: str
    status: PolicyVersionStatus
    is_current: bool
    content: str
    change_summary: str | None = None
    acknowledgement_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PolicyAcknowledgementSummary(BaseModel):
    """Acknowledgement counts only. No invented completion percentage."""

    current_version_label: str | None
    acknowledgement_count: int
    current_user_acknowledged: bool
    current_user_acknowledged_at: datetime | None = None
    semantics: str = (
        "Acknowledgement count is for the current published version only. "
        "Organization-wide completion rate is not defined."
    )


class PolicyListItem(BaseModel):
    id: str
    title: str
    status: PolicyLifecycleStatus
    owner: PersonRef | None = None
    current_version: str | None = None
    acknowledgement_count: int = 0
    updated_at: datetime | None = None


class PolicyDetail(BaseModel):
    id: str
    title: str
    status: PolicyLifecycleStatus
    owner: PersonRef | None = None
    current_version: str | None = None
    versions: list[PolicyVersionSummary] = Field(default_factory=list)
    acknowledgements: PolicyAcknowledgementSummary
    created_at: datetime | None = None
    updated_at: datetime | None = None
    control_mappings: list[str] = Field(
        default_factory=list,
        description="Empty until a policy↔control relationship table exists.",
    )
    semantics: str = POLICY_SEMANTICS


class PolicyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    owner: str | None = Field(
        default=None,
        description="Owner user human id. Defaults to the authenticated actor.",
    )
    initial_version_label: str = Field(default="0.1", min_length=1, max_length=32)
    initial_content: str = Field(
        default="Draft policy content.",
        min_length=1,
        max_length=100_000,
        description="Plain text / Markdown body stored as policy_versions.body_summary.",
    )
    change_summary: str | None = Field(default=None, max_length=4000)


class PolicyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    owner: str | None = Field(default=None, description="Owner user human id, or null to clear.")
    expected_updated_at: datetime | None = None


class PolicyVersionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version_label: str = Field(min_length=1, max_length=32)
    content: str = Field(min_length=1, max_length=100_000)
    change_summary: str | None = Field(default=None, max_length=4000)


class PolicyVersionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str | None = Field(default=None, min_length=1, max_length=100_000)
    change_summary: str | None = Field(default=None, max_length=4000)
    expected_updated_at: datetime | None = None


class PolicyTransition(BaseModel):
    """Lifecycle transition for the policy record.

    Allowed transitions:
    - draft → in_review (policy.manage)
    - in_review → draft (policy.manage)
    - in_review → approved (policy.approve)
    - approved → in_review (policy.manage)
    - approved → published (policy.approve; version_label required)
    - published → published (policy.approve; version_label of a draft replacement)
    - published → retired (policy.approve)

    Publishing marks the named draft version as the sole current published version
    and supersedes any prior current published version.
    """

    model_config = ConfigDict(extra="forbid")

    to_status: PolicyLifecycleStatus
    version_label: str | None = Field(
        default=None,
        max_length=32,
        description="Required when to_status is published.",
    )
    expected_updated_at: datetime | None = None


class PolicyAcknowledgeResult(BaseModel):
    policy_id: str
    version_label: str
    acknowledged: bool
    acknowledged_at: datetime
    already_acknowledged: bool = False
