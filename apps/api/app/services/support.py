"""Small query helpers shared by domain read services."""

from collections.abc import Sequence

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.models.identity import User
from app.schemas.common import ErrorDetail, Page, PersonRef

RISK_METHODOLOGY_LABEL = (
    "AegisBridge internal methodology: score = likelihood × impact. "
    "This is not a NIST-mandated formula."
)
ACTIVE_TELEMETRY = frozenset({"active", "reporting"})
CLOSED_INCIDENT = frozenset({"resolved", "closed"})
CVSS_SEVERITIES = frozenset({"critical", "high", "medium", "low", "unknown"})
RISK_LEVELS = {
    "low": (1, 4),
    "medium": (5, 9),
    "high": (10, 15),
    "critical": (16, 25),
}
SSVC_DECISIONS = frozenset({"track", "track_star", "attend", "act", "pending_review"})


class PageParams:
    def __init__(self, page: int = 1, page_size: int = 25) -> None:
        self.page = page
        self.page_size = page_size


def require_choice(name: str, value: str | None, allowed: frozenset[str]) -> str | None:
    if value is None or value.strip() == "":
        return None
    normalized = value.strip().lower()
    if normalized not in allowed:
        choices = ", ".join(sorted(allowed))
        raise ApiError(
            422,
            "validation_error",
            f"{name} is not a supported value.",
            [ErrorDetail(loc=["query", name], message=f"Use one of: {choices}.")],
        )
    return normalized


def like_pattern(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def person(user: User | None) -> PersonRef | None:
    if user is None:
        return None
    return PersonRef(id=user.human_id, display_name=user.display_name)


def risk_level(score: int | None) -> str | None:
    if score is None:
        return None
    if score >= 16:
        return "critical"
    if score >= 10:
        return "high"
    if score >= 5:
        return "medium"
    return "low"


def cvss_severity(score: float | None) -> str | None:
    """CVSS base-score label only. This is not a combined vulnerability score."""
    if score is None:
        return None
    if score >= 9.0:
        return "critical"
    if score >= 7.0:
        return "high"
    if score >= 4.0:
        return "medium"
    if score > 0:
        return "low"
    return "none"


def paginate[T](
    session: Session,
    statement: Select[T],
    page_params: PageParams,
) -> tuple[int, Sequence[T]]:
    count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
    total = int(session.scalar(count_statement) or 0)
    offset = (page_params.page - 1) * page_params.page_size
    window = statement.offset(offset).limit(page_params.page_size)
    rows = session.scalars(window).unique().all()
    return total, rows


def page[T](page_params: PageParams, total: int, items: list[T]) -> Page[T]:
    return Page(
        page=page_params.page,
        page_size=page_params.page_size,
        total=total,
        items=items,
    )
