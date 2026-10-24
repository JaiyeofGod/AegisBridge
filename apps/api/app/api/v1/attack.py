"""Read the pinned MITRE ATT&CK Enterprise catalog."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, PageQuery, require_permissions
from app.schemas.attack import AttackTacticItem, AttackTechniqueDetail, AttackTechniqueListItem
from app.schemas.common import ErrorBody, Page
from app.services.attack import get_technique, list_tactics, list_techniques

router = APIRouter(
    prefix="/attack",
    tags=["attack"],
    dependencies=[Depends(require_permissions("threat_intel.read"))],
)


@router.get("/tactics", response_model=list[AttackTacticItem])
def read_tactics(
    session: DbSession,
    include_deprecated: bool = False,
) -> list[AttackTacticItem]:
    return list_tactics(session, include_deprecated=include_deprecated)


@router.get("/techniques", response_model=Page[AttackTechniqueListItem])
def read_techniques(
    session: DbSession,
    page: PageQuery,
    q: str | None = None,
    tactic: str | None = None,
    include_subtechniques: bool = True,
    include_deprecated: bool = False,
) -> Page[AttackTechniqueListItem]:
    return list_techniques(
        session,
        page,
        q=q,
        tactic=tactic,
        include_subtechniques=include_subtechniques,
        include_deprecated=include_deprecated,
    )


@router.get(
    "/techniques/{technique_id}",
    response_model=AttackTechniqueDetail,
    responses={404: {"model": ErrorBody}},
)
def read_technique(technique_id: str, session: DbSession) -> AttackTechniqueDetail:
    return get_technique(session, technique_id)
