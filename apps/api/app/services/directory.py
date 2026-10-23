"""Read-only operational user directory. Organization scope comes from the session."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, contains_eager

from app.api.errors import ApiError
from app.models.identity import User
from app.models.organization import Department
from app.schemas.common import Page
from app.schemas.directory import DirectoryUser
from app.security.rbac import AuthenticatedPrincipal
from app.services.support import PageParams, like_pattern, page, paginate


def list_directory_users(
    session: Session,
    principal: AuthenticatedPrincipal,
    page_params: PageParams,
    *,
    q: str | None,
) -> Page[DirectoryUser]:
    organization_id = session.scalar(
        select(User.organization_id).where(User.id == principal.user_id)
    )
    if organization_id is None:
        raise ApiError(401, "unauthenticated", "Authentication is required.")

    statement = (
        select(User)
        .outerjoin(Department, User.department_id == Department.id)
        .options(contains_eager(User.department))
        .where(
            User.organization_id == organization_id,
            func.lower(User.account_status) == "active",
        )
        .order_by(User.display_name.asc(), User.human_id.asc())
    )
    if q is not None and q.strip():
        term = like_pattern(q.strip())
        statement = statement.where(
            or_(
                User.human_id.ilike(term, escape="\\"),
                User.display_name.ilike(term, escape="\\"),
                Department.name.ilike(term, escape="\\"),
            )
        )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_directory_user(row) for row in rows])


def _directory_user(user: User) -> DirectoryUser:
    department = user.department.name if user.department is not None else None
    return DirectoryUser(
        id=user.human_id,
        display_name=user.display_name,
        account_status=user.account_status,
        department=department,
        job_title=user.job_title,
    )
