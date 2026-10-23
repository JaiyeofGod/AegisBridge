"""Risk register contract. Likelihood, impact, and score stay separate."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import PersonRef, RelatedRecord

TreatmentStrategy = Literal["accept", "avoid", "mitigate", "transfer"]
TreatmentStatus = Literal["planned", "in_progress", "complete", "deferred", "cancelled"]

RISK_CONTROL_MAPPING_SEMANTICS = (
    "A risk↔control mapping records that the control is associated with managing this risk. "
    "It does not change likelihood, impact, score, or treatment status, and it does not prove "
    "the control is effective. Effectiveness depends on implementation, tests, and evidence."
)


class RiskListItem(BaseModel):
    id: str
    title: str
    status: str
    methodology: str
    methodology_label: str
    likelihood: int | None
    impact: int | None
    score: int | None
    residual_likelihood: int | None
    residual_impact: int | None
    residual_score: int | None
    risk_level: str | None
    treatment_strategy: str | None
    treatment_status: str | None
    owner: PersonRef | None = None
    asset_id: str | None = None
    asset_hostname: str | None = None


class RiskMappedControl(BaseModel):
    """Mapped control reference. Relationship only — no licensed safeguard prose."""

    id: str
    control_code: str
    title: str
    framework_code: str | None = None
    framework_name: str | None = None
    framework_version: str | None = None
    implementation_status: str | None = None
    licensed_text_included: bool = False


class RiskControlLinkResult(BaseModel):
    linked: bool
    risk_id: str
    control_id: str


class RiskDetail(RiskListItem):
    statement: str
    treatment_notes: str | None
    evidence: list[RelatedRecord]
    reviews: list[RelatedRecord]
    control_mappings: list[RiskMappedControl] = Field(default_factory=list)
    control_mapping_semantics: str = RISK_CONTROL_MAPPING_SEMANTICS
    treatment_updated_at: datetime | None = None


class RiskTreatmentUpdate(BaseModel):
    """Partial treatment patch. Only RiskTreatment columns are writable here."""

    strategy: TreatmentStrategy | None = None
    status: TreatmentStatus | None = None
    notes: str | None = Field(default=None, max_length=4000)
    expected_updated_at: datetime | None = None
