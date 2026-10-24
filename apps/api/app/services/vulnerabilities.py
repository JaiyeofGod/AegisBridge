"""Vulnerability queries and remediation updates. Enrichment factors stay separate."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import ApiError, not_found
from app.core.config import get_settings
from app.models.assets import Asset
from app.models.evidence import EvidenceControlLink, EvidenceRiskLink
from app.models.grc import Control
from app.models.identity import User
from app.models.risk import Risk
from app.models.vulnerability import (
    AssetVulnerability,
    CveRecord,
    EpssSnapshot,
    KevRecord,
    RemediationTask,
    SsvcAssessment,
    Vulnerability,
)
from app.schemas.common import Page, RelatedRecord
from app.schemas.vulnerabilities import (
    VulnerabilityAssetContext,
    VulnerabilityDetail,
    VulnerabilityEpssRead,
    VulnerabilityIntelligenceRead,
    VulnerabilityKevRead,
    VulnerabilityListItem,
    VulnerabilityNvdRead,
    VulnerabilityRemediationUpdate,
)
from app.security.rbac import AuthenticatedPrincipal
from app.services.audit_write import record_audit_event
from app.services.support import (
    CVSS_SEVERITIES,
    SSVC_DECISIONS,
    PageParams,
    cvss_severity,
    like_pattern,
    page,
    paginate,
    person,
    require_choice,
)


def list_vulnerabilities(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    severity: str | None = None,
    kev: bool | None = None,
    action_decision: str | None = None,
    remediation_status: str | None = None,
    asset_criticality: str | None = None,
) -> Page[VulnerabilityListItem]:
    severity_value = require_choice("severity", severity, CVSS_SEVERITIES)
    decision = require_choice("action_decision", action_decision, SSVC_DECISIONS)
    statement = select(Vulnerability).order_by(Vulnerability.human_id)
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                Vulnerability.title.ilike(term, escape="\\"),
                Vulnerability.human_id.ilike(term, escape="\\"),
                Vulnerability.cve_record.has(CveRecord.cve_id.ilike(term, escape="\\")),
            )
        )
    if severity_value == "unknown":
        statement = statement.where(
            or_(
                Vulnerability.cve_record_id.is_(None),
                Vulnerability.cve_record.has(CveRecord.cvss_base_score.is_(None)),
            )
        )
    elif severity_value is not None:
        statement = statement.where(
            Vulnerability.cve_record.has(_severity_case() == severity_value)
        )
    if kev is True:
        statement = statement.where(Vulnerability.cve_record.has(CveRecord.kev_record.has()))
    elif kev is False:
        statement = statement.where(
            or_(
                Vulnerability.cve_record_id.is_(None),
                ~Vulnerability.cve_record.has(CveRecord.kev_record.has()),
            )
        )
    if decision is not None:
        statement = statement.where(
            Vulnerability.asset_findings.any(
                AssetVulnerability.ssvc_assessments.any(SsvcAssessment.decision == decision)
            )
        )
    if remediation_status:
        status = remediation_status.strip().lower()
        statement = statement.where(
            Vulnerability.asset_findings.any(
                or_(
                    AssetVulnerability.remediation_tasks.any(
                        func.lower(RemediationTask.status) == status
                    ),
                    and_(
                        ~AssetVulnerability.remediation_tasks.any(),
                        func.lower(AssetVulnerability.status) == status,
                    ),
                )
            )
        )
    if asset_criticality:
        criticality = asset_criticality.strip().lower()
        statement = statement.where(
            Vulnerability.asset_findings.any(
                func.lower(AssetVulnerability.asset_criticality) == criticality
            )
        )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_item(session, row) for row in rows])


def get_vulnerability(session: Session, vulnerability_id: str) -> VulnerabilityDetail:
    finding = session.scalar(
        select(Vulnerability).where(Vulnerability.human_id == vulnerability_id)
    )
    if finding is None:
        raise not_found("Vulnerability", vulnerability_id)
    item, intelligence, summary = _compose(session, finding)
    return VulnerabilityDetail(
        **item.model_dump(),
        cve_summary=summary,
        intelligence=intelligence,
    )


def update_vulnerability_remediation(
    session: Session,
    principal: AuthenticatedPrincipal,
    vulnerability_id: str,
    patch: VulnerabilityRemediationUpdate,
) -> VulnerabilityDetail:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    # asset_id is a selector only — never a mutable remediation field.
    asset_human_id = payload.pop("asset_id", None)
    if not payload:
        raise ApiError(422, "validation_error", "At least one remediation field is required.")

    finding = session.scalar(
        select(Vulnerability).where(Vulnerability.human_id == vulnerability_id).with_for_update()
    )
    if finding is None:
        raise not_found("Vulnerability", vulnerability_id)

    links = session.scalars(
        select(AssetVulnerability)
        .where(AssetVulnerability.vulnerability_id == finding.id)
        .options(
            selectinload(AssetVulnerability.asset),
            selectinload(AssetVulnerability.remediation_tasks),
        )
        .with_for_update()
    ).all()
    link = _select_asset_finding(list(links), asset_human_id)
    task = _latest_remediation(link.remediation_tasks)
    created = task is None
    if task is None:
        if "status" not in payload or "title" not in payload:
            raise ApiError(
                422,
                "validation_error",
                "Creating a remediation task requires status and title.",
            )
        task = RemediationTask(
            asset_vulnerability_id=link.id,
            title=payload["title"],
            status=payload["status"],
            due_on=payload.get("due_on"),
            owner_user_id=_resolve_owner_id(session, payload["owner"])
            if "owner" in payload
            else None,
        )
        session.add(task)
        changed = sorted(k for k in payload if k in {"status", "title", "due_on", "owner"})
    else:
        if expected is not None:
            _assert_fresh(
                task.updated_at,
                expected,
                "The remediation task was modified by another request.",
            )
        # Never reassign asset_vulnerability_id; asset_id only selected the row above.
        changed = []
        if "status" in payload and task.status != payload["status"]:
            task.status = payload["status"]
            changed.append("status")
        if "title" in payload and task.title != payload["title"]:
            task.title = payload["title"]
            changed.append("title")
        if "due_on" in payload and task.due_on != payload["due_on"]:
            task.due_on = payload["due_on"]
            changed.append("due_on")
        if "owner" in payload:
            new_owner_id = _resolve_owner_id(session, payload["owner"])
            if task.owner_user_id != new_owner_id:
                task.owner_user_id = new_owner_id
                changed.append("owner")
        task.updated_at = datetime.now(UTC)

    settings = get_settings()
    record_audit_event(
        session,
        organization_id=finding.organization_id,
        action="VULNERABILITY_REMEDIATION_UPDATE",
        object_type="vulnerability",
        object_id=finding.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=(
            f"{'Created' if created else 'Updated'} remediation fields: "
            f"{', '.join(changed) if changed else 'none'}."
        ),
    )
    session.commit()
    return get_vulnerability(session, vulnerability_id)


def _item(session: Session, finding: Vulnerability) -> VulnerabilityListItem:
    item, _intelligence, _summary = _compose(session, finding)
    return item


def _compose(
    session: Session, finding: Vulnerability
) -> tuple[VulnerabilityListItem, VulnerabilityIntelligenceRead, str | None]:
    cve = finding.cve_record if finding.cve_record_id is not None else None
    if cve is None and finding.cve_record_id is not None:
        cve = session.get(CveRecord, finding.cve_record_id)
    epss = _latest_epss(session, cve)
    kev = (
        None
        if cve is None
        else session.scalar(select(KevRecord).where(KevRecord.cve_record_id == cve.id))
    )
    score = None if cve is None or cve.cvss_base_score is None else float(cve.cvss_base_score)
    contexts = [
        _asset_context(session, link)
        for link in session.scalars(
            select(AssetVulnerability)
            .where(AssetVulnerability.vulnerability_id == finding.id)
            .options(selectinload(AssetVulnerability.asset))
            .order_by(AssetVulnerability.asset_id)
        ).all()
    ]
    return (
        VulnerabilityListItem(
            id=finding.human_id,
            title=finding.title,
            cve_id=None if cve is None else cve.cve_id,
            cvss_version=None if cve is None else cve.cvss_version,
            cvss_base_score=score,
            cvss_vector=None if cve is None else cve.cvss_vector,
            cvss_severity=cvss_severity(score),
            epss=None if epss is None else float(epss.epss),
            epss_percentile=None
            if epss is None or epss.percentile is None
            else float(epss.percentile),
            epss_observed_on=None if epss is None else epss.observed_on,
            kev_listed=kev is not None,
            kev_date_added=None if kev is None else kev.date_added,
            known_ransomware_use=None if kev is None else kev.known_ransomware_use,
            assets=contexts,
        ),
        _intelligence(cve, epss, kev),
        None if cve is None else cve.summary,
    )


def _intelligence(
    cve: CveRecord | None,
    epss: EpssSnapshot | None,
    kev: KevRecord | None,
) -> VulnerabilityIntelligenceRead:
    return VulnerabilityIntelligenceRead(
        nvd=VulnerabilityNvdRead(
            published_at=None if cve is None else cve.published_at,
            source_modified_at=None if cve is None else cve.source_modified_at,
            fetched_at=None if cve is None else cve.nvd_fetched_at,
        ),
        kev=VulnerabilityKevRead(
            checked_at=None if cve is None else cve.kev_checked_at,
            due_on=None if kev is None else kev.due_on,
            required_action=None if kev is None else kev.required_action,
            vendor_project=None if kev is None else kev.vendor_project,
            product=None if kev is None else kev.product,
        ),
        epss=VulnerabilityEpssRead(
            observed_on=None if epss is None else epss.observed_on,
            fetched_at=None if epss is None else epss.fetched_at,
        ),
    )


def _asset_context(session: Session, link: AssetVulnerability) -> VulnerabilityAssetContext:
    asset = link.asset or session.get(Asset, link.asset_id)
    decision = session.scalar(
        select(SsvcAssessment)
        .where(SsvcAssessment.asset_vulnerability_id == link.id)
        .order_by(SsvcAssessment.assessed_at.desc())
    )
    task = session.scalar(
        select(RemediationTask)
        .where(RemediationTask.asset_vulnerability_id == link.id)
        .options(selectinload(RemediationTask.owner))
        .order_by(RemediationTask.created_at.desc())
    )
    if asset is None:
        asset_id = ""
        hostname = ""
    else:
        asset_id = asset.human_id
        hostname = asset.hostname
    return VulnerabilityAssetContext(
        asset_id=asset_id,
        hostname=hostname,
        exposure=link.exposure,
        asset_criticality=link.asset_criticality,
        status=link.status,
        action_decision=None if decision is None else decision.decision,
        action_rationale=None if decision is None else decision.rationale,
        action_assessed_at=None if decision is None else decision.assessed_at,
        remediation_status=None if task is None else task.status,
        remediation_title=None if task is None else task.title,
        due_on=None if task is None else task.due_on,
        owner=None if task is None else person(task.owner),
        mitigating_controls=_mitigating_controls(session, link.asset_id),
        remediation_updated_at=None if task is None else task.updated_at,
    )


def _select_asset_finding(
    findings: list[AssetVulnerability],
    asset_human_id: str | None,
) -> AssetVulnerability:
    if not findings:
        raise ApiError(
            422,
            "validation_error",
            "This vulnerability has no asset findings to remediate.",
        )
    if asset_human_id:
        target = asset_human_id.strip()
        for link in findings:
            asset = link.asset
            if asset is not None and asset.human_id == target:
                return link
        raise ApiError(
            422,
            "validation_error",
            "Asset finding was not found for this vulnerability.",
        )
    if len(findings) > 1:
        raise ApiError(
            422,
            "validation_error",
            "asset_id is required when the vulnerability has multiple asset findings.",
        )
    return findings[0]


def _latest_remediation(tasks: list[RemediationTask]) -> RemediationTask | None:
    if not tasks:
        return None
    return max(tasks, key=lambda item: item.created_at)


def _resolve_owner_id(session: Session, owner_human_id: str | None):
    if owner_human_id is None:
        return None
    user = session.scalar(select(User).where(User.human_id == owner_human_id.strip()))
    if user is None:
        raise ApiError(422, "validation_error", "Owner user was not found.")
    return user.id


def _assert_fresh(current: datetime, expected: datetime, message: str) -> None:
    left = current if current.tzinfo is not None else current.replace(tzinfo=UTC)
    right = expected if expected.tzinfo is not None else expected.replace(tzinfo=UTC)
    if left != right:
        raise ApiError(409, "conflict", message)


def _mitigating_controls(session: Session, asset_id: UUID) -> list[RelatedRecord]:
    controls = (
        session.scalars(
            select(Control)
            .join(EvidenceControlLink, EvidenceControlLink.control_id == Control.id)
            .join(EvidenceRiskLink, EvidenceRiskLink.evidence_id == EvidenceControlLink.evidence_id)
            .join(Risk, Risk.id == EvidenceRiskLink.risk_id)
            .where(Risk.asset_id == asset_id)
            .order_by(Control.human_id)
        )
        .unique()
        .all()
    )
    return [
        RelatedRecord(
            id=control.human_id,
            title=f"{control.control_code} {control.title}",
            summary="Related through evidence on a risk for the same asset. Not a control test.",
        )
        for control in controls
    ]


def _latest_epss(session: Session, cve: CveRecord | None) -> EpssSnapshot | None:
    if cve is None:
        return None
    return session.scalar(
        select(EpssSnapshot)
        .where(EpssSnapshot.cve_record_id == cve.id)
        .order_by(EpssSnapshot.observed_on.desc())
    )


def _severity_case():
    score = CveRecord.cvss_base_score
    return case(
        (score >= 9, "critical"),
        (score >= 7, "high"),
        (score >= 4, "medium"),
        else_="low",
    )
