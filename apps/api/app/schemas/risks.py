"""Risk register contract. Likelihood, impact, and score stay separate."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import PersonRef, RelatedRecord

TreatmentStrategy = Literal["accept", "avoid", "mitigate", "transfer"]
TreatmentStatus = Literal["planned", "in_progress", "complete", "deferred", "cancelled"]


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


class RiskDetail(RiskListItem):
    statement: str
    treatment_notes: str | None
    evidence: list[RelatedRecord]
    reviews: list[RelatedRecord]
    treatment_updated_at: datetime | None = None


class RiskTreatmentUpdate(BaseModel):
    """Partial treatment patch. Only RiskTreatment columns are writable here."""

    strategy: TreatmentStrategy | None = None
    status: TreatmentStatus | None = None
    notes: str | None = Field(default=None, max_length=4000)
    expected_updated_at: datetime | None = None
