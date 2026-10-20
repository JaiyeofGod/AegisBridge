"""Governance summary. Control text from licensed catalogs is not returned."""

from pydantic import BaseModel

from app.schemas.common import PersonRef


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
