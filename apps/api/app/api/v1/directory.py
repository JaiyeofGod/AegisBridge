"""Operational user directory. Not an Administration user-management API."""

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentPrincipal, DbSession, PageQuery, require_permissions
from app.schemas.common import ErrorBody, Page
from app.schemas.directory import DirectoryUser
from app.services.directory import list_directory_users

router = APIRouter(
    prefix="/directory",
    tags=["directory"],
    dependencies=[Depends(require_permissions("directory.read"))],
)


@router.get(
    "/users",
    response_model=Page[DirectoryUser],
    responses={401: {"model": ErrorBody}, 403: {"model": ErrorBody}},
)
def read_directory_users(
    session: DbSession,
    principal: CurrentPrincipal,
    page: PageQuery,
    q: str | None = Query(
        None,
        description=(
            "Case-insensitive substring search of human id, display name, and "
            "department name. Does not search email, roles, permissions, credentials, "
            "or audit data. Results stay inside the caller's organization and include "
            "active users only."
        ),
    ),
) -> Page[DirectoryUser]:
    """List active users in the caller's organization for operational selection.

    Organization scope comes from the authenticated session. There is no
    organization query parameter. This is not an Administration endpoint:
    account changes, roles, and user status stay on the administration API.
    `directory.read` is required. `administration.read` is not. GET only; no CSRF.
    """
    return list_directory_users(session, principal, page, q=q)
