"""Read-only risks."""

from fastapi import APIRouter

from app.api.deps import DbSession, PageQuery
from app.schemas.common import ErrorBody, Page
from app.schemas.risks import RiskDetail, RiskListItem
from app.services.risks import get_risk, list_risks

router = APIRouter(prefix="/risks", tags=["risks"])


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
