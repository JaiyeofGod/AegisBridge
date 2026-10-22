"""Evidence metadata and private object upload/download API."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from starlette.responses import StreamingResponse

from app.api.deps import CurrentPrincipal, DbSession, RequireCsrf, require_permissions
from app.schemas.common import ErrorBody
from app.schemas.evidence import EvidenceCreate, EvidenceDetail, EvidenceObjectDeleteResult
from app.services.evidence import create_evidence, get_evidence
from app.services.evidence_objects import (
    delete_evidence_object,
    download_evidence_object,
    upload_evidence_object,
)

EvidenceUploadFile = Annotated[
    UploadFile,
    File(description="Opaque evidence bytes. Multipart field name: file."),
]

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
    """Return evidence metadata. Object keys and storage credentials are never included."""
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
    """Create evidence metadata only. CSRF required. Upload bytes separately."""
    return create_evidence(session, principal, body)


@router.post(
    "/{evidence_id}/object",
    response_model=EvidenceDetail,
    responses={
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
        422: {"model": ErrorBody},
        503: {"model": ErrorBody},
    },
    dependencies=[Depends(require_permissions("evidence.manage"))],
)
def post_evidence_object(
    evidence_id: str,
    session: DbSession,
    principal: RequireCsrf,
    file: EvidenceUploadFile,
) -> EvidenceDetail:
    """Upload a private evidence object. CSRF required. Malware scanning is not implemented."""
    return upload_evidence_object(session, principal, evidence_id, file)


@router.get(
    "/{evidence_id}/object",
    responses={
        404: {"model": ErrorBody},
        503: {"model": ErrorBody},
    },
)
def get_evidence_object(
    evidence_id: str,
    session: DbSession,
    principal: CurrentPrincipal,
) -> StreamingResponse:
    """Stream a private evidence object through the API. Authenticated; no CSRF."""
    return download_evidence_object(session, principal, evidence_id)


@router.delete(
    "/{evidence_id}/object",
    response_model=EvidenceObjectDeleteResult,
    responses={404: {"model": ErrorBody}, 503: {"model": ErrorBody}},
    dependencies=[Depends(require_permissions("evidence.manage"))],
)
def remove_evidence_object(
    evidence_id: str,
    session: DbSession,
    principal: RequireCsrf,
) -> EvidenceObjectDeleteResult:
    """Delete stored object bytes. Preserves the evidence metadata record. CSRF required."""
    return delete_evidence_object(session, principal, evidence_id)
