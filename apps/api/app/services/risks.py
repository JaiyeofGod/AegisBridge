"""Risk register queries."""

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import not_found
from app.models.assets import Asset
from app.models.evidence import Evidence, EvidenceRiskLink
from app.models.identity import User
from app.models.risk import Risk, RiskAssessment, RiskReview, RiskTreatment
from app.schemas.common import Page, RelatedRecord
from app.schemas.risks import RiskDetail, RiskListItem
from app.services.support import (
    RISK_LEVELS,
    RISK_METHODOLOGY_LABEL,
    PageParams,
    like_pattern,
    page,
    paginate,
    person,
    require_choice,
    risk_level,
)


def list_risks(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    risk_level_filter: str | None = None,
    treatment_status: str | None = None,
    owner: str | None = None,
) -> Page[RiskListItem]:
    level = require_choice("risk_level", risk_level_filter, frozenset(RISK_LEVELS))
    statement = (
        select(Risk)
        .options(
            selectinload(Risk.owner),
            selectinload(Risk.asset),
            selectinload(Risk.assessments),
            selectinload(Risk.treatments),
        )
        .order_by(Risk.human_id)
    )
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                Risk.title.ilike(term, escape="\\"),
                Risk.human_id.ilike(term, escape="\\"),
                Risk.statement.ilike(term, escape="\\"),
            )
        )
    if level is not None:
        low, high = RISK_LEVELS[level]
        statement = statement.where(
            Risk.assessments.any(
                and_(
                    RiskAssessment.is_current.is_(True),
                    RiskAssessment.score >= low,
                    RiskAssessment.score <= high,
                )
            )
        )
    if treatment_status:
        statement = statement.where(
            Risk.treatments.any(
                func.lower(RiskTreatment.status) == treatment_status.strip().lower()
            )
        )
    if owner:
        term = like_pattern(owner.strip())
        statement = statement.where(
            Risk.owner.has(
                or_(
                    User.display_name.ilike(term, escape="\\"),
                    User.human_id.ilike(term, escape="\\"),
                )
            )
        )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_list_item(row) for row in rows])


def get_risk(session: Session, risk_id: str) -> RiskDetail:
    risk = session.scalar(
        select(Risk)
        .where(Risk.human_id == risk_id)
        .options(
            selectinload(Risk.owner),
            selectinload(Risk.asset),
            selectinload(Risk.assessments),
            selectinload(Risk.treatments),
            selectinload(Risk.reviews).selectinload(RiskReview.reviewer),
        )
    )
    if risk is None:
        raise not_found("Risk", risk_id)
    evidence_rows = session.scalars(
        select(Evidence)
        .join(EvidenceRiskLink, EvidenceRiskLink.evidence_id == Evidence.id)
        .where(EvidenceRiskLink.risk_id == risk.id)
        .order_by(Evidence.human_id)
    ).all()
    item = _list_item(risk)
    treatment = _treatment(risk)
    return RiskDetail(
        **item.model_dump(),
        statement=risk.statement,
        treatment_notes=None if treatment is None else treatment.notes,
        evidence=[
            RelatedRecord(
                id=evidence.human_id,
                title=evidence.title,
                summary="SHA-256 metadata is stored. File bytes are not.",
            )
            for evidence in evidence_rows
        ],
        reviews=[
            RelatedRecord(
                id=review.reviewed_at.isoformat(),
                title=review.outcome,
                status=review.outcome,
                summary=review.notes,
            )
            for review in risk.reviews
        ],
    )


def _list_item(risk: Risk) -> RiskListItem:
    assessment = _assessment(risk)
    treatment = _treatment(risk)
    asset: Asset | None = risk.asset
    return RiskListItem(
        id=risk.human_id,
        title=risk.title,
        status=risk.status,
        methodology=risk.methodology,
        methodology_label=RISK_METHODOLOGY_LABEL,
        likelihood=None if assessment is None else assessment.likelihood,
        impact=None if assessment is None else assessment.impact,
        score=None if assessment is None else assessment.score,
        residual_likelihood=None if assessment is None else assessment.residual_likelihood,
        residual_impact=None if assessment is None else assessment.residual_impact,
        residual_score=None if assessment is None else assessment.residual_score,
        risk_level=None if assessment is None else risk_level(assessment.score),
        treatment_strategy=None if treatment is None else treatment.strategy,
        treatment_status=None if treatment is None else treatment.status,
        owner=person(risk.owner),
        asset_id=None if asset is None else asset.human_id,
        asset_hostname=None if asset is None else asset.hostname,
    )


def _assessment(risk: Risk) -> RiskAssessment | None:
    current = [item for item in risk.assessments if item.is_current]
    if current:
        return current[0]
    if not risk.assessments:
        return None
    return max(risk.assessments, key=lambda item: item.assessed_at)


def _treatment(risk: Risk) -> RiskTreatment | None:
    if not risk.treatments:
        return None
    return max(risk.treatments, key=lambda item: item.created_at)
