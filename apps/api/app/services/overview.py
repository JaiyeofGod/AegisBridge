"""Overview counts derived from stored records. No combined score is calculated."""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.assets import Asset
from app.models.grc import Control, ControlImplementation, ControlTest
from app.models.identity import AccessReview, AccessReviewFinding
from app.models.incident import Incident
from app.models.integration import Integration
from app.models.organization import Organization
from app.models.risk import Risk
from app.models.soc import AlertReference, Investigation
from app.models.vulnerability import (
    AssetVulnerability,
    CveRecord,
    KevRecord,
    RemediationTask,
    Vulnerability,
)
from app.schemas.overview import (
    ControlPosture,
    KevExposure,
    OverviewResponse,
    SummaryNote,
    TelemetryPosture,
    WorkItem,
)
from app.security.rbac import AuthenticatedPrincipal
from app.services.support import ACTIVE_TELEMETRY, CLOSED_INCIDENT, person

KEV_SEMANTICS = (
    "Exposed means the asset exposure is internet and the finding has a KEV catalog row. "
    "CVSS and EPSS are not added into this count."
)
CONTROL_SEMANTICS = (
    "Passed counts control tests whose result is pass. "
    "Assessed applicable counts implementations other than not_applicable."
)
TELEMETRY_SEMANTICS = (
    "Active counts assets whose telemetry_status is active or reporting. "
    "reference_only and not_connected are absences, not healthy agents."
)

_WORK_KIND_PERMISSION = {
    "remediation": "vulnerability.read",
    "risk": "risk.read",
    "incident": "incident.read",
    "investigation": "alert.read",
    "access_review": "administration.read",
}


def get_overview(session: Session, principal: AuthenticatedPrincipal) -> OverviewResponse:
    organization = session.scalar(select(Organization).order_by(Organization.name))
    can_vuln = principal.has_permission("vulnerability.read")
    can_incident = principal.has_permission("incident.read")
    can_control = principal.has_permission("control.read")
    can_asset = principal.has_permission("asset.read")
    can_alert = principal.has_permission("alert.read")
    can_integration = principal.has_permission("integration.read")

    exposed_assets: list[str] = []
    cve_ids: list[str] = []
    if can_vuln:
        exposed_assets, cve_ids = _kev_exposure(session)

    return OverviewResponse(
        generated_at=datetime.now(UTC),
        organization_name=None if organization is None else organization.name,
        data_origin=None if organization is None else organization.data_origin,
        environment_label=None if organization is None else organization.environment_label,
        kev_exposure=(
            KevExposure(
                exposed_asset_count=len(exposed_assets),
                distinct_cve_count=len(cve_ids),
                asset_ids=exposed_assets,
                cve_ids=cve_ids,
                semantics=KEV_SEMANTICS,
            )
            if can_vuln
            else KevExposure(
                exposed_asset_count=0,
                distinct_cve_count=0,
                asset_ids=[],
                cve_ids=[],
                semantics=KEV_SEMANTICS,
            )
        ),
        open_incidents=_open_incident_count(session) if can_incident else 0,
        control_posture=(
            _control_posture(session)
            if can_control
            else ControlPosture(passed=0, assessed_applicable=0, semantics=CONTROL_SEMANTICS)
        ),
        telemetry=(
            _telemetry(session)
            if can_asset
            else TelemetryPosture(active=0, expected=0, semantics=TELEMETRY_SEMANTICS)
        ),
        my_work=_filter_work(_my_work(session), principal),
        security_highlights=_filter_highlights(
            _highlights(session, exposed_assets, cve_ids, include_alerts=can_alert),
            can_vuln=can_vuln,
            can_alert=can_alert,
            can_incident=can_incident,
        ),
        executive_notes=_executive_notes(
            session,
            organization,
            include_wazuh=can_integration,
            include_coverage=can_control,
        ),
    )


def _filter_work(items: list[WorkItem], principal: AuthenticatedPrincipal) -> list[WorkItem]:
    filtered: list[WorkItem] = []
    for item in items:
        required = _WORK_KIND_PERMISSION.get(item.kind)
        if required is None or principal.has_permission(required):
            filtered.append(item)
    return filtered


def _filter_highlights(
    notes: list[SummaryNote],
    *,
    can_vuln: bool,
    can_alert: bool,
    can_incident: bool,
) -> list[SummaryNote]:
    kept: list[SummaryNote] = []
    for note in notes:
        if note.id == "kev-exposure":
            if can_vuln:
                kept.append(note)
            continue
        if note.id == "telemetry-not-connected":
            if can_alert:
                kept.append(note)
            continue
        if can_incident:
            kept.append(note)
    return kept


def _kev_exposure(session: Session) -> tuple[list[str], list[str]]:
    rows = session.execute(
        select(Asset.human_id, CveRecord.cve_id)
        .join(AssetVulnerability, AssetVulnerability.asset_id == Asset.id)
        .join(Vulnerability, Vulnerability.id == AssetVulnerability.vulnerability_id)
        .join(CveRecord, CveRecord.id == Vulnerability.cve_record_id)
        .join(KevRecord, KevRecord.cve_record_id == CveRecord.id)
        .where(Asset.exposure == "internet")
        .order_by(Asset.human_id, CveRecord.cve_id)
    ).all()
    assets = list(dict.fromkeys(row[0] for row in rows))
    cves = list(dict.fromkeys(row[1] for row in rows))
    return assets, cves


def _open_incident_count(session: Session) -> int:
    statuses = session.scalars(select(Incident.status)).all()
    return sum(1 for status in statuses if status.lower() not in CLOSED_INCIDENT)


def _control_posture(session: Session) -> ControlPosture:
    results = session.scalars(select(ControlTest.result)).all()
    implementations = session.scalars(select(ControlImplementation.status)).all()
    passed = sum(1 for result in results if result.lower() == "pass")
    assessed = sum(1 for status in implementations if status.lower() != "not_applicable")
    return ControlPosture(
        passed=passed,
        assessed_applicable=assessed,
        semantics=CONTROL_SEMANTICS,
    )


def _telemetry(session: Session) -> TelemetryPosture:
    statuses = session.scalars(select(Asset.telemetry_status)).all()
    active = sum(1 for status in statuses if status.lower() in ACTIVE_TELEMETRY)
    return TelemetryPosture(
        active=active,
        expected=len(statuses),
        semantics=TELEMETRY_SEMANTICS,
    )


def _my_work(session: Session) -> list[WorkItem]:
    items: list[WorkItem] = []
    tasks = session.scalars(
        select(RemediationTask)
        .options(
            selectinload(RemediationTask.owner),
            selectinload(RemediationTask.asset_vulnerability).selectinload(
                AssetVulnerability.vulnerability
            ),
        )
        .order_by(RemediationTask.created_at)
    ).all()
    for task in tasks:
        if task.status.lower() in {"complete", "completed", "verified", "closed"}:
            continue
        finding = task.asset_vulnerability.vulnerability
        items.append(
            WorkItem(
                id=finding.human_id,
                kind="remediation",
                title=task.title,
                status=task.status,
                owner=person(task.owner),
            )
        )
    risks = session.scalars(
        select(Risk).options(selectinload(Risk.owner)).order_by(Risk.human_id)
    ).all()
    items.extend(
        WorkItem(
            id=risk.human_id,
            kind="risk",
            title=risk.title,
            status=risk.status,
            owner=person(risk.owner),
        )
        for risk in risks
        if risk.status.lower() == "open"
    )
    incidents = session.scalars(
        select(Incident).options(selectinload(Incident.owner)).order_by(Incident.human_id)
    ).all()
    items.extend(
        WorkItem(
            id=incident.human_id,
            kind="incident",
            title=incident.title,
            status=incident.status,
            owner=person(incident.owner),
        )
        for incident in incidents
        if incident.status.lower() not in CLOSED_INCIDENT
    )
    investigations = session.scalars(
        select(Investigation)
        .options(selectinload(Investigation.assignee))
        .order_by(Investigation.human_id)
    ).all()
    items.extend(
        WorkItem(
            id=item.human_id,
            kind="investigation",
            title=item.title,
            status=item.status,
            owner=person(item.assignee),
        )
        for item in investigations
        if item.status.lower() not in CLOSED_INCIDENT
    )
    reviews = session.scalars(select(AccessReview).order_by(AccessReview.human_id)).all()
    items.extend(
        WorkItem(
            id=review.human_id,
            kind="access_review",
            title=review.name,
            status=review.status,
            owner=None,
        )
        for review in reviews
        if review.status.lower() not in {"closed", "complete", "completed"}
    )
    return items


def _highlights(
    session: Session,
    asset_ids: list[str],
    cve_ids: list[str],
    *,
    include_alerts: bool,
) -> list[SummaryNote]:
    notes: list[SummaryNote] = []
    if asset_ids and cve_ids:
        notes.append(
            SummaryNote(
                id="kev-exposure",
                title="Known exploited vulnerability on an internet-exposed asset",
                detail=(
                    f"{', '.join(cve_ids)} is listed in KEV on {', '.join(asset_ids)}. "
                    "CVSS, EPSS, and the SSVC decision remain separate fields."
                ),
            )
        )
    if include_alerts:
        alert_count = session.scalar(select(func.count()).select_from(AlertReference)) or 0
        if alert_count:
            notes.append(
                SummaryNote(
                    id="telemetry-not-connected",
                    title="Alert references are not a live Wazuh feed",
                    detail=(
                        "Stored alert rows are selected metadata. "
                        "telemetry_source not_connected means Wazuh was not queried."
                    ),
                )
            )
    incident = session.scalar(select(Incident).order_by(Incident.human_id))
    if incident is not None:
        notes.append(
            SummaryNote(
                id=incident.human_id.lower(),
                title=incident.title,
                detail=incident.summary,
            )
        )
    return notes


def _executive_notes(
    session: Session,
    organization: Organization | None,
    *,
    include_wazuh: bool,
    include_coverage: bool,
) -> list[SummaryNote]:
    origin = "unknown" if organization is None else organization.data_origin
    environment = "unspecified" if organization is None else organization.environment_label
    notes = [
        SummaryNote(
            id="data-origin",
            title="Data origin",
            detail=f"Organization data origin is {origin}. Environment label: {environment}.",
        ),
        SummaryNote(
            id="risk-methodology",
            title="Risk methodology",
            detail=(
                "Risk score is likelihood × impact on a 1–5 scale. "
                "It is an internal AegisBridge method, not a combined security score."
            ),
        ),
    ]
    if include_wazuh:
        integration = session.scalar(select(Integration).where(Integration.name == "Wazuh"))
        wazuh_status = "not_recorded" if integration is None else integration.status
        notes.append(
            SummaryNote(
                id="wazuh",
                title="Wazuh",
                detail=(
                    f"Integration status is {wazuh_status}. "
                    "No connector credentials are returned by this API."
                ),
            )
        )
    if include_coverage:
        control_count = session.scalar(select(func.count()).select_from(Control)) or 0
        finding_count = session.scalar(select(func.count()).select_from(AccessReviewFinding)) or 0
        notes.append(
            SummaryNote(
                id="coverage",
                title="Record coverage",
                detail=(
                    f"{control_count} control record(s) and {finding_count} access-review "
                    "finding(s) are stored. Empty sections are absences, not healthy zeros."
                ),
            )
        )
    return notes
