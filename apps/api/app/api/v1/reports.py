"""Read-only report definition contracts."""

from fastapi import APIRouter

from app.api.deps import DbSession, PageQuery
from app.schemas.common import ErrorBody, Page
from app.schemas.reports import ReportDefinitionDetail, ReportDefinitionListItem, ReportsSummary
from app.services.reports import get_definition, get_summary, list_definitions

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=ReportsSummary)
def read_summary(session: DbSession) -> ReportsSummary:
    return get_summary(session)


@router.get("/definitions", response_model=Page[ReportDefinitionListItem])
def read_definitions(
    session: DbSession,
    page: PageQuery,
    search: str | None = None,
    status: str | None = None,
    report_type: str | None = None,
) -> Page[ReportDefinitionListItem]:
    return list_definitions(
        session,
        page,
        search=search,
        status=status,
        report_type=report_type,
    )


@router.get(
    "/definitions/{report_id}",
    response_model=ReportDefinitionDetail,
    responses={404: {"model": ErrorBody}},
)
def read_definition(report_id: str, session: DbSession) -> ReportDefinitionDetail:
    return get_definition(session, report_id)
