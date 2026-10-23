"""Governance contracts. Licensed CIS safeguard text is never returned."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PersonRef

ImplementationStatus = Literal[
    "planned",
    "partial",
    "implemented",
    "not_implemented",
    "not_applicable",
]

ControlTestResult = Literal["pass", "fail", "partial", "inconclusive"]


class FrameworkSummary(BaseModel):
    code: str
    name: str
    version: str | None
    control_count: int
    licensed_text_included: bool


class ControlImplementationCounts(BaseModel):
    by_status: dict[str, int]
    tests_passed: int
    tests_recorded: int
    assessed_applicable: int


class EvidenceFreshness(BaseModel):
    recorded: int
    with_sha256: int
    missing_collected_at: int
    semantics: str


class AssessmentWork(BaseModel):
    tests_recorded: int
    items: list[str]


class PolicyStatusItem(BaseModel):
    id: str
    title: str
    status: str
    current_version: str | None
    acknowledgement_count: int
    owner: PersonRef | None = None


class AccessReviewStatusItem(BaseModel):
    id: str
    name: str
    status: str
    open_findings: int
    total_findings: int


class GovernanceSummary(BaseModel):
    frameworks: list[FrameworkSummary]
    control_implementations: ControlImplementationCounts
    evidence_freshness: EvidenceFreshness
    assessment_work: AssessmentWork
    policies: list[PolicyStatusItem]
    access_reviews: list[AccessReviewStatusItem]


class ControlListItem(BaseModel):
    id: str
    control_code: str
    title: str
    family: str | None
    framework_code: str | None
    framework_version: str | None
    implementation_status: str | None
    test_count: int
    evidence_count: int


class ControlImplementationDetail(BaseModel):
    status: str
    notes: str | None
    owner: PersonRef | None
    updated_at: datetime | None = None


class ControlTestItem(BaseModel):
    id: str
    control_id: str
    result: str
    tested_at: datetime
    tester: PersonRef | None
    notes: str | None
    updated_at: datetime | None = None
    recording_mode: str = "manual"


class ControlEvidenceItem(BaseModel):
    id: str
    title: str
    sha256: str | None
    collected_at: datetime | None


class ControlMappedPolicy(BaseModel):
    """Minimal policy reference from a control. No nested version bodies."""

    id: str
    title: str
    status: str
    current_version: str | None = None


class ControlMappedRisk(BaseModel):
    """Minimal risk reference from a control. No treatment history or residual metrics."""

    id: str
    title: str
    likelihood: int | None = None
    impact: int | None = None
    score: int | None = None
    treatment_status: str | None = None


class ControlDetail(ControlListItem):
    implementation: ControlImplementationDetail | None = None
    tests: list[ControlTestItem] = Field(default_factory=list)
    evidence: list[ControlEvidenceItem] = Field(default_factory=list)
    policies: list[ControlMappedPolicy] = Field(default_factory=list)
    risks: list[ControlMappedRisk] = Field(default_factory=list)
    licensed_text_included: bool = False
    updated_at: datetime | None = None


class ControlImplementationUpdate(BaseModel):
    """Partial update of the current control implementation row."""

    model_config = ConfigDict(extra="forbid")

    status: ImplementationStatus | None = None
    notes: str | None = Field(default=None, max_length=8000)
    owner: str | None = Field(
        default=None,
        description="Owner user human id (e.g. USR-0003). Null clears the owner.",
    )
    expected_updated_at: datetime | None = None


class ControlTestCreate(BaseModel):
    """Manually recorded control test. Not an automated assessment."""

    model_config = ConfigDict(extra="forbid")

    result: ControlTestResult
    tested_at: datetime | None = None
    tester: str | None = Field(
        default=None,
        description="Tester user human id. Defaults to the authenticated actor.",
    )
    notes: str | None = Field(default=None, max_length=8000)


class ControlTestUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    result: ControlTestResult | None = None
    tested_at: datetime | None = None
    tester: str | None = Field(
        default=None,
        description="Tester user human id. Null clears the tester.",
    )
    notes: str | None = Field(default=None, max_length=8000)
    expected_updated_at: datetime | None = None
