"""Read-only dataset experiment contracts."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, PageQuery, require_permissions
from app.schemas.common import ErrorBody, Page
from app.schemas.datasets import ExperimentDetail, ExperimentListItem
from app.services.datasets import get_experiment, list_experiments

router = APIRouter(
    prefix="/dataset-experiments",
    tags=["dataset-experiments"],
    dependencies=[Depends(require_permissions("dataset.read"))],
)


@router.get("", response_model=Page[ExperimentListItem])
def read_experiments(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    status: str | None = None,
    dataset_id: str | None = None,
    experiment_type: str | None = None,
) -> Page[ExperimentListItem]:
    return list_experiments(
        session,
        page,
        search=search,
        status=status,
        dataset_id=dataset_id,
        experiment_type=experiment_type,
    )


@router.get(
    "/{experiment_id}",
    response_model=ExperimentDetail,
    responses={404: {"model": ErrorBody}},
)
def read_experiment(experiment_id: str, session: DbSession) -> ExperimentDetail:
    return get_experiment(session, experiment_id)
