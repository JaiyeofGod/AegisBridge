"""Read-only overview. Authenticated users only; sections honor permissions."""

from fastapi import APIRouter

from app.api.deps import CurrentPrincipal, DbSession
from app.schemas.overview import OverviewResponse
from app.services.overview import get_overview

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("", response_model=OverviewResponse)
def read_overview(session: DbSession, principal: CurrentPrincipal) -> OverviewResponse:
    """Stored posture counts. This response has no aggregate security score.

    Any authenticated principal may call this endpoint. Domain summary sections
    are included only when the caller holds the matching ``*.read`` permission.
    """
    return get_overview(session, principal)
