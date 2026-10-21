"""Read-only governance summary."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_permissions
from app.schemas.governance import GovernanceSummary
from app.services.governance import get_governance_summary

router = APIRouter(
    prefix="/governance",
    tags=["governance"],
    dependencies=[Depends(require_permissions("control.read"))],
)


@router.get("/summary", response_model=GovernanceSummary)
def read_governance_summary(session: DbSession) -> GovernanceSummary:
    """Framework identifiers and statuses. Licensed control text is not included."""
    return get_governance_summary(session)
