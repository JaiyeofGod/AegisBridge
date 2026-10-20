"""Vulnerability queries. CVSS, EPSS, KEV, exposure, and SSVC stay separate."""

from uuid import UUID

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import not_found
from app.models.assets import Asset
from app.models.evidence import EvidenceControlLink, EvidenceRiskLink
from app.models.grc import Control
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
    VulnerabilityListItem,
)
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
    item = _item(session, finding)
    cve = finding.cve_record
    return VulnerabilityDetail(
        **item.model_dump(),
        cve_summary=None if cve is None else cve.summary,
    )


def _item(session: Session, finding: Vulnerability) -> VulnerabilityListItem:
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
    return VulnerabilityListItem(
        id=finding.human_id,
        title=finding.title,
        cve_id=None if cve is None else cve.cve_id,
        cvss_version=None if cve is None else cve.cvss_version,
        cvss_base_score=score,
        cvss_vector=None if cve is None else cve.cvss_vector,
        cvss_severity=cvss_severity(score),
        epss=None if epss is None else float(epss.epss),
        epss_percentile=None if epss is None or epss.percentile is None else float(epss.percentile),
        epss_observed_on=None if epss is None else epss.observed_on,
        kev_listed=kev is not None,
        kev_date_added=None if kev is None else kev.date_added,
        known_ransomware_use=None if kev is None else kev.known_ransomware_use,
        assets=contexts,
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
    )


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
