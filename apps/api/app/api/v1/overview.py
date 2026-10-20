"""Read-only overview."""

from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.overview import OverviewResponse
from app.services.overview import get_overview

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("", response_model=OverviewResponse)
def read_overview(session: DbSession) -> OverviewResponse:
    """Stored posture counts. This response has no aggregate security score."""
    return get_overview(session)
