"""Read-only dataset registry contracts."""

from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession, PageQuery, require_permissions
from app.schemas.common import ErrorBody, Page
from app.schemas.datasets import DatasetDetail, DatasetListItem
from app.services.datasets import get_dataset, list_datasets

router = APIRouter(
    prefix="/datasets",
    tags=["datasets"],
    dependencies=[Depends(require_permissions("dataset.read"))],
)


@router.get("", response_model=Page[DatasetListItem])
def read_datasets(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    status: str | None = None,
    domain: str | None = None,
    verification_status: str | None = None,
    publication_year: int | None = Query(None),
) -> Page[DatasetListItem]:
    return list_datasets(
        session,
        page,
        search=search,
        status=status,
        domain=domain,
        verification_status=verification_status,
        publication_year=publication_year,
    )


@router.get(
    "/{dataset_id}",
    response_model=DatasetDetail,
    responses={404: {"model": ErrorBody}},
)
def read_dataset(dataset_id: str, session: DbSession) -> DatasetDetail:
    return get_dataset(session, dataset_id)
