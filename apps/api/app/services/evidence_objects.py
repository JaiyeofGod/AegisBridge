"""Private evidence object upload, download, and deletion."""

from __future__ import annotations

import hashlib
import logging
import tempfile
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from starlette.responses import StreamingResponse

from app.api.errors import ApiError, not_found
from app.core.config import get_settings
from app.models.evidence import Evidence, EvidenceControlLink, EvidenceObject
from app.schemas.evidence import EvidenceDetail, EvidenceObjectDeleteResult
from app.security.rbac import AuthenticatedPrincipal
from app.services.audit_write import record_audit_event
from app.services.support import person
from app.storage.factory import get_object_storage
from app.storage.filenames import sanitize_original_filename
from app.storage.protocol import ObjectStorage

logger = logging.getLogger(__name__)

_READ_CHUNK = 64 * 1024


def upload_evidence_object(
    session: Session,
    principal: AuthenticatedPrincipal,
    evidence_id: str,
    upload: UploadFile,
    storage: ObjectStorage | None = None,
) -> EvidenceDetail:
    settings = get_settings()
    backend = storage or get_object_storage()
    evidence = _load_evidence(session, evidence_id, for_update=True)
    if evidence.stored_object is not None:
        raise ApiError(
            409,
            "conflict",
            "This evidence record already has a stored object. Replacement is not supported.",
        )

    original_filename = sanitize_original_filename(upload.filename)
    content_type = (upload.content_type or "application/octet-stream").strip()[:120] or None
    object_key = f"evidence/{evidence.human_id}/{uuid4().hex}"
    digest = hashlib.sha256()
    size = 0
    max_bytes = settings.evidence_max_upload_bytes

    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix="aegis-evidence-",
            suffix=".bin",
            delete=False,
        ) as tmp:
            tmp_path = Path(tmp.name)
            while True:
                chunk = upload.file.read(_READ_CHUNK)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise ApiError(
                        422,
                        "validation_error",
                        f"Evidence uploads must be at most {max_bytes} bytes.",
                    )
                digest.update(chunk)
                tmp.write(chunk)
            tmp.flush()

        if size == 0:
            raise ApiError(422, "validation_error", "Empty files are not accepted.")

        sha256 = digest.hexdigest()
        with tmp_path.open("rb") as handle:
            stored = backend.put_file(
                object_key=object_key,
                fileobj=handle,
                content_type=content_type,
                size_bytes=size,
            )

        try:
            row = EvidenceObject(
                evidence_id=evidence.id,
                provider=backend.provider_label,
                bucket=stored.bucket,
                object_key=stored.object_key,
                original_filename=original_filename,
                content_type=content_type,
                size_bytes=size,
                sha256=sha256,
                stored_at=datetime.now(UTC),
            )
            session.add(row)
            evidence.sha256 = sha256
            evidence.size_bytes = size
            evidence.mime_type = content_type
            # Opaque storage reference for operational ops; never returned by the API.
            evidence.object_uri = f"s3://{stored.bucket}/{stored.object_key}"
            evidence.updated_at = datetime.now(UTC)
            record_audit_event(
                session,
                organization_id=evidence.organization_id,
                action="EVIDENCE_OBJECT_UPLOAD",
                object_type="evidence_object",
                object_id=evidence.human_id,
                result="success",
                actor_user_id=principal.user_id,
                actor_label=principal.human_id,
                environment_name=settings.app_env,
                detail=(
                    f"Uploaded private evidence object. filename={original_filename}; "
                    f"size_bytes={size}; sha256={sha256}; provider={backend.provider_label}."
                ),
            )
            session.commit()
        except ApiError:
            try:
                backend.delete(object_key=object_key)
            except Exception:
                logger.exception(
                    "Failed to clean up evidence object after DB persistence error for %s",
                    evidence.human_id,
                )
            raise
        except Exception as exc:
            try:
                backend.delete(object_key=object_key)
            except Exception:
                logger.exception(
                    "Failed to clean up evidence object after DB persistence error for %s",
                    evidence.human_id,
                )
            raise ApiError(
                500,
                "internal_error",
                "Evidence object could not be persisted after upload.",
            ) from exc
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

    return get_evidence_detail(session, evidence.human_id)


def download_evidence_object(
    session: Session,
    principal: AuthenticatedPrincipal,
    evidence_id: str,
    storage: ObjectStorage | None = None,
) -> StreamingResponse:
    settings = get_settings()
    backend = storage or get_object_storage()
    evidence = _load_evidence(session, evidence_id, for_update=False)
    obj = evidence.stored_object
    if obj is None:
        raise ApiError(404, "not_found", f"Evidence {evidence_id} has no stored object.")

    stream, _info = backend.get_stream(object_key=obj.object_key)
    record_audit_event(
        session,
        organization_id=evidence.organization_id,
        action="EVIDENCE_OBJECT_DOWNLOAD",
        object_type="evidence_object",
        object_id=evidence.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=(
            f"Downloaded private evidence object. filename={obj.original_filename}; "
            f"size_bytes={obj.size_bytes}; sha256={obj.sha256}."
        ),
    )
    session.commit()

    headers = {
        "Content-Disposition": _content_disposition(obj.original_filename),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
    }
    media_type = obj.content_type or "application/octet-stream"
    return StreamingResponse(_guarded_stream(stream), media_type=media_type, headers=headers)


def delete_evidence_object(
    session: Session,
    principal: AuthenticatedPrincipal,
    evidence_id: str,
    storage: ObjectStorage | None = None,
) -> EvidenceObjectDeleteResult:
    """Remove storage bytes and the evidence_objects row. Preserves the evidence metadata record.

    PostgreSQL and S3 do not share a distributed transaction. Storage is deleted first; if the
    database update then fails, the object may already be gone and the error is returned.
    """
    settings = get_settings()
    backend = storage or get_object_storage()
    evidence = _load_evidence(session, evidence_id, for_update=True)
    obj = evidence.stored_object
    if obj is None:
        raise ApiError(404, "not_found", f"Evidence {evidence_id} has no stored object.")

    object_key = obj.object_key
    filename = obj.original_filename
    size_bytes = obj.size_bytes
    sha256 = obj.sha256
    backend.delete(object_key=object_key)

    session.delete(obj)
    evidence.object_uri = None
    # Keep ingestion hash/size as historical metadata on the evidence row.
    evidence.updated_at = datetime.now(UTC)
    record_audit_event(
        session,
        organization_id=evidence.organization_id,
        action="EVIDENCE_OBJECT_DELETE",
        object_type="evidence_object",
        object_id=evidence.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=(
            f"Deleted private evidence object. filename={filename}; "
            f"size_bytes={size_bytes}; sha256={sha256}. Evidence metadata record preserved."
        ),
    )
    session.commit()
    return EvidenceObjectDeleteResult(
        evidence_id=evidence.human_id,
        object_stored=False,
        deleted=True,
    )


def get_evidence_detail(session: Session, evidence_id: str) -> EvidenceDetail:
    evidence = _load_evidence(session, evidence_id, for_update=False)
    return _detail(evidence)


def _load_evidence(session: Session, evidence_id: str, *, for_update: bool) -> Evidence:
    statement = (
        select(Evidence)
        .where(Evidence.human_id == evidence_id)
        .options(
            selectinload(Evidence.collected_by),
            selectinload(Evidence.control_links).selectinload(EvidenceControlLink.control),
            selectinload(Evidence.stored_object),
        )
    )
    if for_update:
        statement = statement.with_for_update()
    evidence = session.scalar(statement)
    if evidence is None:
        raise not_found("Evidence", evidence_id)
    return evidence


def _detail(evidence: Evidence) -> EvidenceDetail:
    obj = evidence.stored_object
    object_stored = obj is not None
    return EvidenceDetail(
        id=evidence.human_id,
        title=evidence.title,
        description=evidence.description,
        version_label=evidence.version_label,
        sha256=evidence.sha256,
        size_bytes=evidence.size_bytes if obj is None else obj.size_bytes,
        mime_type=evidence.mime_type if obj is None else obj.content_type,
        data_classification=evidence.data_classification,
        collected_at=evidence.collected_at,
        collected_by=person(evidence.collected_by),
        control_ids=sorted(
            link.control.human_id for link in evidence.control_links if link.control is not None
        ),
        updated_at=evidence.updated_at,
        object_stored=object_stored,
        integrity_verified=False,
        original_filename=None if obj is None else obj.original_filename,
        stored_at=None if obj is None else obj.stored_at,
        storage_provider=None if obj is None else obj.provider,
        content_type=None if obj is None else obj.content_type,
        hash_source="server_calculated_at_ingestion" if object_stored else None,
    )


def _content_disposition(filename: str) -> str:
    safe = filename.replace('"', "")
    return f'attachment; filename="{safe}"'


def _guarded_stream(stream: Iterator[bytes]) -> Iterator[bytes]:
    yield from stream
