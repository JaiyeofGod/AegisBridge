"""Evidence metadata API. File upload and object storage are out of scope."""

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, RequireCsrf, require_permissions
from app.schemas.common import ErrorBody
from app.schemas.evidence import EvidenceCreate, EvidenceDetail
from app.services.evidence import create_evidence, get_evidence

router = APIRouter(
    prefix="/evidence",
    tags=["evidence"],
    dependencies=[Depends(require_permissions("evidence.read"))],
)


@router.get(
    "/{evidence_id}",
    response_model=EvidenceDetail,
    responses={404: {"model": ErrorBody}},
)
def read_evidence(evidence_id: str, session: DbSession) -> EvidenceDetail:
    """Return evidence metadata. Object URIs and file bytes are never included."""
    return get_evidence(session, evidence_id)


@router.post(
    "",
    response_model=EvidenceDetail,
    responses={422: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("evidence.manage"))],
)
def post_evidence(
    body: EvidenceCreate,
    session: DbSession,
    principal: RequireCsrf,
) -> EvidenceDetail:
    """Create evidence metadata only. No file upload. CSRF required."""
    return create_evidence(session, principal, body)
