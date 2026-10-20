"""Risk register contract. Likelihood, impact, and score stay separate."""

from pydantic import BaseModel

from app.schemas.common import PersonRef, RelatedRecord


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
