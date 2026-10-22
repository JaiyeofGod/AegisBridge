"""Evidence metadata creation and control linking. No file upload in this slice."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.errors import ApiError, not_found
from app.core.config import get_settings
from app.models.evidence import Evidence, EvidenceControlLink
from app.models.grc import Control
from app.models.identity import User
from app.schemas.evidence import ControlEvidenceLinkResult, EvidenceCreate, EvidenceDetail
from app.security.rbac import AuthenticatedPrincipal
from app.services.audit_write import record_audit_event
from app.services.support import next_human_id, normalize_sha256, person


def get_evidence(session: Session, evidence_id: str) -> EvidenceDetail:
    evidence = _load_evidence(session, evidence_id, for_update=False)
    return _detail(evidence)


def create_evidence(
    session: Session,
    principal: AuthenticatedPrincipal,
    body: EvidenceCreate,
) -> EvidenceDetail:
    actor = session.get(User, principal.user_id)
    if actor is None:
        raise ApiError(401, "unauthenticated", "Authentication is required.")

    collector_id = (
        principal.user_id
        if body.collected_by is None
        else _resolve_user_id(session, body.collected_by)
    )
    sha256 = normalize_sha256(body.sha256)
    human_id = next_human_id(session, Evidence.human_id, "EVID")
    row = Evidence(
        organization_id=actor.organization_id,
        collected_by_user_id=collector_id,
        human_id=human_id,
        title=body.title.strip(),
        description=body.description,
        version_label=body.version_label.strip(),
        sha256=sha256,
        size_bytes=body.size_bytes,
        mime_type=body.mime_type,
        object_uri=None,
        data_classification=body.data_classification,
        collected_at=body.collected_at,
    )
    session.add(row)
    session.flush()
    settings = get_settings()
    record_audit_event(
        session,
        organization_id=actor.organization_id,
        action="EVIDENCE_CREATE",
        object_type="evidence",
        object_id=human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=(
            "Created evidence metadata record. "
            f"sha256={'present' if sha256 else 'absent'}; object_stored=false."
        ),
    )
    session.commit()
    return get_evidence(session, human_id)


def link_control_evidence(
    session: Session,
    principal: AuthenticatedPrincipal,
    control_id: str,
    evidence_id: str,
) -> ControlEvidenceLinkResult:
    control = session.scalar(select(Control).where(Control.human_id == control_id))
    if control is None:
        raise not_found("Control", control_id)
    evidence = _load_evidence(session, evidence_id, for_update=True)
    if evidence.organization_id != control.organization_id:
        raise ApiError(404, "not_found", f"Evidence {evidence_id} was not found.")

    existing = session.scalar(
        select(EvidenceControlLink).where(
            EvidenceControlLink.evidence_id == evidence.id,
            EvidenceControlLink.control_id == control.id,
        )
    )
    if existing is not None:
        return ControlEvidenceLinkResult(
            control_id=control.human_id,
            evidence_id=evidence.human_id,
            linked=True,
        )

    session.add(EvidenceControlLink(evidence_id=evidence.id, control_id=control.id))
    try:
        session.flush()
    except IntegrityError as exc:
        raise ApiError(409, "conflict", "Evidence is already linked to this control.") from exc

    settings = get_settings()
    record_audit_event(
        session,
        organization_id=control.organization_id,
        action="CONTROL_EVIDENCE_LINK",
        object_type="evidence_control_link",
        object_id=f"{control.human_id}:{evidence.human_id}",
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Linked evidence {evidence.human_id} to control {control.human_id}.",
    )
    session.commit()
    return ControlEvidenceLinkResult(
        control_id=control.human_id,
        evidence_id=evidence.human_id,
        linked=True,
    )


def unlink_control_evidence(
    session: Session,
    principal: AuthenticatedPrincipal,
    control_id: str,
    evidence_id: str,
) -> ControlEvidenceLinkResult:
    control = session.scalar(select(Control).where(Control.human_id == control_id))
    if control is None:
        raise not_found("Control", control_id)
    evidence = session.scalar(select(Evidence).where(Evidence.human_id == evidence_id))
    if evidence is None:
        raise not_found("Evidence", evidence_id)

    link = session.scalar(
        select(EvidenceControlLink)
        .where(
            EvidenceControlLink.evidence_id == evidence.id,
            EvidenceControlLink.control_id == control.id,
        )
        .with_for_update()
    )
    if link is None:
        raise ApiError(404, "not_found", "Evidence is not linked to this control.")

    session.delete(link)
    settings = get_settings()
    record_audit_event(
        session,
        organization_id=control.organization_id,
        action="CONTROL_EVIDENCE_UNLINK",
        object_type="evidence_control_link",
        object_id=f"{control.human_id}:{evidence.human_id}",
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Unlinked evidence {evidence.human_id} from control {control.human_id}.",
    )
    session.commit()
    return ControlEvidenceLinkResult(
        control_id=control.human_id,
        evidence_id=evidence.human_id,
        linked=False,
    )


def _load_evidence(session: Session, evidence_id: str, *, for_update: bool) -> Evidence:
    statement = (
        select(Evidence)
        .where(Evidence.human_id == evidence_id)
        .options(
            selectinload(Evidence.collected_by),
            selectinload(Evidence.control_links).selectinload(EvidenceControlLink.control),
        )
    )
    if for_update:
        statement = statement.with_for_update()
    evidence = session.scalar(statement)
    if evidence is None:
        raise not_found("Evidence", evidence_id)
    return evidence


def _detail(evidence: Evidence) -> EvidenceDetail:
    return EvidenceDetail(
        id=evidence.human_id,
        title=evidence.title,
        description=evidence.description,
        version_label=evidence.version_label,
        sha256=evidence.sha256,
        size_bytes=evidence.size_bytes,
        mime_type=evidence.mime_type,
        data_classification=evidence.data_classification,
        collected_at=evidence.collected_at,
        collected_by=person(evidence.collected_by),
        control_ids=sorted(
            link.control.human_id for link in evidence.control_links if link.control is not None
        ),
        updated_at=evidence.updated_at,
        object_stored=False,
        integrity_verified=False,
    )


def _resolve_user_id(session: Session, human_id: str):
    user = session.scalar(select(User).where(User.human_id == human_id.strip()))
    if user is None:
        raise ApiError(422, "validation_error", "Collector user was not found.")
    return user.id
