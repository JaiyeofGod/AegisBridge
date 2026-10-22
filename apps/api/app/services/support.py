"""Small query helpers shared by domain read services."""

from collections.abc import Mapping, Sequence
from re import fullmatch
from typing import Any

from sqlalchemy import Select, asc, desc, func, select
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


def require_sort_direction(direction: str | None) -> str:
    """Return ``asc`` or ``desc``. Empty defaults to ascending."""
    if direction is None or direction.strip() == "":
        return "asc"
    normalized = direction.strip().lower()
    if normalized not in {"asc", "desc"}:
        raise ApiError(
            422,
            "validation_error",
            "direction is not a supported value.",
            [ErrorDetail(loc=["query", "direction"], message="Use one of: asc, desc.")],
        )
    return normalized


def resolve_order_by(
    *,
    sort: str | None,
    direction: str | None,
    allowed: Mapping[str, Any],
    default: str,
    tiebreak: Any,
) -> list[Any]:
    """Map a public sort key to explicit SQLAlchemy columns. Rejects arbitrary names."""
    sort_direction = require_sort_direction(direction)
    order = asc if sort_direction == "asc" else desc
    key = default if sort is None or sort.strip() == "" else sort.strip().lower()
    column = allowed.get(key)
    if column is None:
        choices = ", ".join(sorted(set(allowed)))
        raise ApiError(
            422,
            "validation_error",
            "sort is not a supported value.",
            [ErrorDetail(loc=["query", "sort"], message=f"Use one of: {choices}.")],
        )
    clauses: list[Any] = [order(column)]
    if column is not tiebreak:
        clauses.append(asc(tiebreak))
    return clauses


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


def next_human_id(session: Session, column, prefix: str) -> str:
    """Allocate the next ``PREFIX-NNNN`` public id for a human_id column."""
    pattern = f"{prefix}-%"
    existing = session.scalars(select(column).where(column.like(pattern))).all()
    highest = 0
    for value in existing:
        suffix = value.rsplit("-", maxsplit=1)[-1]
        if suffix.isdigit():
            highest = max(highest, int(suffix))
    return f"{prefix}-{highest + 1:04d}"


def normalize_sha256(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not fullmatch(r"[0-9a-f]{64}", normalized):
        raise ApiError(
            422,
            "validation_error",
            "sha256 must be exactly 64 lowercase hexadecimal characters.",
        )
    return normalized
