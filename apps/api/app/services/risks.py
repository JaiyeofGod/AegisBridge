"""Risk register queries and treatment updates."""

from datetime import UTC, datetime

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.errors import ApiError, not_found
from app.core.config import get_settings
from app.models.assets import Asset
from app.models.evidence import Evidence, EvidenceRiskLink
from app.models.grc import Control, ControlImplementation, FrameworkVersion
from app.models.identity import User
from app.models.risk import Risk, RiskAssessment, RiskControlMapping, RiskReview, RiskTreatment
from app.schemas.common import Page, RelatedRecord
from app.schemas.risks import (
    RiskControlLinkResult,
    RiskDetail,
    RiskListItem,
    RiskMappedControl,
    RiskTreatmentUpdate,
)
from app.security.rbac import AuthenticatedPrincipal
from app.services.audit_write import record_audit_event
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

TREATMENT_STRATEGIES = frozenset({"accept", "avoid", "mitigate", "transfer"})
TREATMENT_STATUSES = frozenset({"planned", "in_progress", "complete", "deferred", "cancelled"})


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
            selectinload(Risk.control_links)
            .selectinload(RiskControlMapping.control)
            .selectinload(Control.framework_version)
            .selectinload(FrameworkVersion.framework),
            selectinload(Risk.control_links)
            .selectinload(RiskControlMapping.control)
            .selectinload(Control.implementations),
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
        treatment_updated_at=None if treatment is None else treatment.updated_at,
        evidence=[
            RelatedRecord(
                id=evidence.human_id,
                title=evidence.title,
                summary="SHA-256 metadata is stored. File bytes are not.",
            )
            for evidence in evidence_rows
        ],
        control_mappings=[
            _mapped_control(link.control) for link in risk.control_links if link.control is not None
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


def update_risk_treatment(
    session: Session,
    principal: AuthenticatedPrincipal,
    risk_id: str,
    patch: RiskTreatmentUpdate,
) -> RiskDetail:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    if not payload:
        raise ApiError(422, "validation_error", "At least one treatment field is required.")

    risk = session.scalar(
        select(Risk)
        .where(Risk.human_id == risk_id)
        .options(selectinload(Risk.treatments))
        .with_for_update()
    )
    if risk is None:
        raise not_found("Risk", risk_id)

    treatment = _treatment(risk)
    created = treatment is None
    if treatment is None:
        if "strategy" not in payload or "status" not in payload:
            raise ApiError(
                422,
                "validation_error",
                "Creating a treatment requires strategy and status.",
            )
        treatment = RiskTreatment(
            risk_id=risk.id,
            strategy=payload["strategy"],
            status=payload["status"],
            notes=payload.get("notes"),
        )
        session.add(treatment)
        changed = sorted(payload.keys())
    else:
        if expected is not None:
            current = treatment.updated_at
            if current.tzinfo is None:
                current = current.replace(tzinfo=UTC)
            provided = expected
            if provided.tzinfo is None:
                provided = provided.replace(tzinfo=UTC)
            if current != provided:
                raise ApiError(
                    409,
                    "conflict",
                    "The risk treatment was modified by another request.",
                )
        changed = []
        for field in ("strategy", "status", "notes"):
            if field not in payload:
                continue
            new_value = payload[field]
            if getattr(treatment, field) != new_value:
                setattr(treatment, field, new_value)
                changed.append(field)
        treatment.updated_at = datetime.now(UTC)

    settings = get_settings()
    record_audit_event(
        session,
        organization_id=risk.organization_id,
        action="RISK_TREATMENT_UPDATE",
        object_type="risk",
        object_id=risk.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=(
            f"{'Created' if created else 'Updated'} treatment fields: "
            f"{', '.join(changed) if changed else 'none'}."
        ),
    )
    session.commit()
    return get_risk(session, risk_id)


def link_risk_control(
    session: Session,
    principal: AuthenticatedPrincipal,
    risk_id: str,
    control_id: str,
) -> RiskControlLinkResult:
    """Associate a control with a risk. Does not change scores, treatment, or control status."""
    risk = session.scalar(select(Risk).where(Risk.human_id == risk_id).with_for_update())
    if risk is None:
        raise not_found("Risk", risk_id)
    control = session.scalar(select(Control).where(Control.human_id == control_id))
    if control is None or control.organization_id != risk.organization_id:
        raise not_found("Control", control_id)

    existing = session.scalar(
        select(RiskControlMapping).where(
            RiskControlMapping.risk_id == risk.id,
            RiskControlMapping.control_id == control.id,
        )
    )
    if existing is not None:
        return RiskControlLinkResult(
            linked=True,
            risk_id=risk.human_id,
            control_id=control.human_id,
        )

    session.add(RiskControlMapping(risk_id=risk.id, control_id=control.id))
    try:
        session.flush()
    except IntegrityError as exc:
        raise ApiError(409, "conflict", "Control is already linked to this risk.") from exc

    settings = get_settings()
    record_audit_event(
        session,
        organization_id=risk.organization_id,
        action="RISK_CONTROL_LINK",
        object_type="risk_control_mapping",
        object_id=f"{risk.human_id}:{control.human_id}",
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Linked risk {risk.human_id} to control {control.human_id}.",
    )
    session.commit()
    return RiskControlLinkResult(
        linked=True,
        risk_id=risk.human_id,
        control_id=control.human_id,
    )


def unlink_risk_control(
    session: Session,
    principal: AuthenticatedPrincipal,
    risk_id: str,
    control_id: str,
) -> RiskControlLinkResult:
    """Remove the risk↔control relationship only. Missing links return 404."""
    risk = session.scalar(select(Risk).where(Risk.human_id == risk_id))
    if risk is None:
        raise not_found("Risk", risk_id)
    control = session.scalar(select(Control).where(Control.human_id == control_id))
    if control is None or control.organization_id != risk.organization_id:
        raise not_found("Control", control_id)

    link = session.scalar(
        select(RiskControlMapping)
        .where(
            RiskControlMapping.risk_id == risk.id,
            RiskControlMapping.control_id == control.id,
        )
        .with_for_update()
    )
    if link is None:
        raise ApiError(404, "not_found", "Control is not linked to this risk.")

    session.delete(link)
    settings = get_settings()
    record_audit_event(
        session,
        organization_id=risk.organization_id,
        action="RISK_CONTROL_UNLINK",
        object_type="risk_control_mapping",
        object_id=f"{risk.human_id}:{control.human_id}",
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Unlinked risk {risk.human_id} from control {control.human_id}.",
    )
    session.commit()
    return RiskControlLinkResult(
        linked=False,
        risk_id=risk.human_id,
        control_id=control.human_id,
    )


def _mapped_control(control: Control) -> RiskMappedControl:
    framework = control.framework_version
    implementation = _latest_implementation(control.implementations)
    return RiskMappedControl(
        id=control.human_id,
        control_code=control.control_code,
        title=control.title,
        framework_code=None if framework is None else framework.framework.code,
        framework_name=None if framework is None else framework.framework.name,
        framework_version=None if framework is None else framework.version_label,
        implementation_status=None if implementation is None else implementation.status,
        licensed_text_included=False,
    )


def _latest_implementation(rows: list[ControlImplementation]) -> ControlImplementation | None:
    if not rows:
        return None
    return sorted(rows, key=lambda row: (row.updated_at, row.created_at), reverse=True)[0]


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
