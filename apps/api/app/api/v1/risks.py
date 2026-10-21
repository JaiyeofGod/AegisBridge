"""Risk register reads and treatment updates."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, PageQuery, RequireCsrf, require_permissions
from app.schemas.common import ErrorBody, Page
from app.schemas.risks import RiskDetail, RiskListItem, RiskTreatmentUpdate
from app.services.risks import get_risk, list_risks, update_risk_treatment

router = APIRouter(
    prefix="/risks",
    tags=["risks"],
    dependencies=[Depends(require_permissions("risk.read"))],
)


@router.get("", response_model=Page[RiskListItem], responses={422: {"model": ErrorBody}})
def read_risks(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    risk_level: str | None = None,
    treatment_status: str | None = None,
    owner: str | None = None,
) -> Page[RiskListItem]:
    return list_risks(
        session,
        page,
        search=search,
        risk_level_filter=risk_level,
        treatment_status=treatment_status,
        owner=owner,
    )


@router.get("/{risk_id}", response_model=RiskDetail, responses={404: {"model": ErrorBody}})
def read_risk(risk_id: str, session: DbSession) -> RiskDetail:
    return get_risk(session, risk_id)


@router.patch(
    "/{risk_id}/treatment",
    response_model=RiskDetail,
    responses={404: {"model": ErrorBody}, 409: {"model": ErrorBody}, 422: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("risk.manage"))],
)
def patch_risk_treatment(
    risk_id: str,
    body: RiskTreatmentUpdate,
    session: DbSession,
    principal: RequireCsrf,
) -> RiskDetail:
    return update_risk_treatment(session, principal, risk_id, body)
