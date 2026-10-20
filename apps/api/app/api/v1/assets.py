"""Read-only assets."""

from fastapi import APIRouter

from app.api.deps import DbSession, PageQuery
from app.schemas.assets import AssetDetail, AssetListItem
from app.schemas.common import ErrorBody, Page
from app.services.assets import get_asset, list_assets

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=Page[AssetListItem])
def read_assets(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    asset_type: str | None = None,
    criticality: str | None = None,
    environment: str | None = None,
    telemetry_status: str | None = None,
) -> Page[AssetListItem]:
    return list_assets(
        session,
        page,
        search=search,
        asset_type=asset_type,
        criticality=criticality,
        environment=environment,
        telemetry_status=telemetry_status,
    )


@router.get(
    "/{asset_id}",
    response_model=AssetDetail,
    responses={404: {"model": ErrorBody}},
)
def read_asset(
    asset_id: str,
    session: DbSession,
) -> AssetDetail:
    return get_asset(session, asset_id)
