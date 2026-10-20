"""Deterministic development seed. Not an Alembic migration and not production data."""

from __future__ import annotations

import argparse
import hashlib
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import (
    AccessEntitlement,
    AccessReview,
    AccessReviewFinding,
    AlertReference,
    Asset,
    AssetDataRelationship,
    AssetOwner,
    AssetType,
    AssetVulnerability,
    AttackTechnique,
    AuditEvent,
    Base,
    BusinessProcess,
    Control,
    ControlImplementation,
    CveRecord,
    DataAsset,
    Dataset,
    DatasetExperiment,
    DatasetVersion,
    Department,
    Detection,
    DetectionAttackMapping,
    DetectionVersion,
    EpssSnapshot,
    Evidence,
    EvidenceControlLink,
    EvidenceRiskLink,
    Framework,
    FrameworkVersion,
    Incident,
    IncidentEvent,
    IncidentEvidence,
    Integration,
    Investigation,
    KevRecord,
    Organization,
    Permission,
    Policy,
    PolicyAcknowledgement,
    PolicyVersion,
    RemediationTask,
    ReportDefinition,
    Risk,
    RiskAssessment,
    RiskTreatment,
    Role,
    SsvcAssessment,
    SyncState,
    ThreatAdvisory,
    ThreatIndicator,
    ThreatIntelSource,
    User,
    UserRole,
    Vendor,
    VendorService,
    Vulnerability,
)

ORG_SLUG = "aegisbridge-technologies"


def reset_domain_tables(session: Session) -> None:
    """Delete domain rows. Local development only. Does not touch alembic_version."""
    settings = get_settings()
    if settings.app_env not in {"local", "development", "dev", "test"}:
        raise RuntimeError("Refusing to reset domain tables outside a local environment.")
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()


def seed_development(session: Session) -> None:
    existing = session.scalar(select(Organization).where(Organization.slug == ORG_SLUG))
    if existing is not None:
        _ensure_contract_records(session, existing)
        session.commit()
        return

    org = Organization(
        name="AegisBridge Technologies",
        slug=ORG_SLUG,
        environment_label="Lab · Simulated",
        data_origin="simulated",
    )
    session.add(org)
    session.flush()

    departments = {
        name: Department(organization_id=org.id, name=name)
        for name in ("Security", "GRC", "Operations", "Finance")
    }
    session.add_all(departments.values())
    session.flush()

    session.add(
        BusinessProcess(
            organization_id=org.id,
            department_id=departments["Finance"].id,
            name="Finance close",
            description="Simulated month-end close supported by FIN-APP-01.",
        )
    )

    permissions = {
        code: Permission(code=code, description=description)
        for code, description in (
            ("integration.manage", "Label for integration setup. Not enforced."),
            ("user.role.manage", "Label for role assignment. Not enforced."),
            ("risk.accept", "Label for risk acceptance. Not enforced."),
            ("control.update", "Label for control updates. Not enforced."),
            ("evidence.download", "Label for evidence download. Not enforced."),
            ("incident.close", "Label for incident closure. Not enforced."),
        )
    }
    session.add_all(permissions.values())
    session.flush()

    role_rows = {
        "Administrator": (
            "Platform configuration, users, roles, and integrations.",
            ("integration.manage", "user.role.manage"),
        ),
        "CISO": ("Reads executive posture, risks, and major incidents.", ()),
        "GRC Analyst": (
            "Works risks, controls, and evidence.",
            ("risk.accept", "control.update", "evidence.download"),
        ),
        "SOC Analyst": ("Triages alerts and incident tasks.", ("incident.close",)),
        "Auditor": ("Reads evidence and audit history.", ("evidence.download",)),
        "Read Only": ("Reads records without write labels.", ()),
    }
    roles: dict[str, Role] = {}
    for name, (summary, _codes) in role_rows.items():
        role = Role(organization_id=org.id, name=name, summary=summary)
        roles[name] = role
        session.add(role)
    session.flush()

    users = {
        "USR-0001": User(
            organization_id=org.id,
            department_id=departments["Security"].id,
            human_id="USR-0001",
            email="amara.okonkwo@aegisbridge.example",
            display_name="Amara Okonkwo",
            job_title="Security administrator",
            account_status="active",
            timezone_name="America/New_York",
        ),
        "USR-0003": User(
            organization_id=org.id,
            department_id=departments["GRC"].id,
            human_id="USR-0003",
            email="priya.shah@aegisbridge.example",
            display_name="Priya Shah",
            job_title="GRC analyst",
            account_status="active",
            timezone_name="America/New_York",
        ),
        "USR-0004": User(
            organization_id=org.id,
            department_id=departments["Security"].id,
            human_id="USR-0004",
            email="jonah.hale@aegisbridge.example",
            display_name="Jonah Hale",
            job_title="SOC analyst",
            account_status="active",
            timezone_name="America/New_York",
        ),
        "USR-0005": User(
            organization_id=org.id,
            department_id=departments["GRC"].id,
            human_id="USR-0005",
            email="marcus.reid@aegisbridge.example",
            display_name="Marcus Reid",
            job_title="Auditor",
            account_status="active",
            timezone_name="America/New_York",
        ),
    }
    session.add_all(users.values())
    session.flush()

    assignments = {
        "USR-0001": "Administrator",
        "USR-0003": "GRC Analyst",
        "USR-0004": "SOC Analyst",
        "USR-0005": "Auditor",
    }
    for user_code, role_name in assignments.items():
        session.add(UserRole(user_id=users[user_code].id, role_id=roles[role_name].id))
        for code in role_rows[role_name][1]:
            session.add(
                AccessEntitlement(
                    user_id=users[user_code].id,
                    permission_id=permissions[code].id,
                    grant_source="role_catalog",
                )
            )

    review = AccessReview(
        organization_id=org.id,
        human_id="ARV-0001",
        name="October access review",
        status="in_progress",
    )
    session.add(review)
    session.flush()
    session.add(
        AccessReviewFinding(
            access_review_id=review.id,
            user_id=users["USR-0005"].id,
            finding="Simulated review due. No live directory was queried.",
            status="open",
        )
    )

    asset_types = {
        code: AssetType(code=code, name=name)
        for code, name in (
            ("linux_server", "Linux server"),
            ("windows_endpoint", "Windows endpoint"),
            ("security_platform", "Security platform"),
            ("network_device", "Network device"),
        )
    }
    session.add_all(asset_types.values())
    session.flush()

    seen = datetime(2026, 10, 19, 21, 12, tzinfo=UTC)
    assets = {
        "FIN-APP-01": Asset(
            organization_id=org.id,
            asset_type_id=asset_types["linux_server"].id,
            human_id="AST-0007",
            hostname="FIN-APP-01",
            name="Finance application",
            criticality="critical",
            exposure="internet",
            lifecycle="active",
            environment_name="simulated",
            data_classification="restricted",
            platform="Linux",
            os_version="Ubuntu 24.04 LTS",
            ip_address="10.40.12.21",
            telemetry_status="reference_only",
            last_seen_at=seen,
        ),
        "WIN-WS-07": Asset(
            organization_id=org.id,
            asset_type_id=asset_types["windows_endpoint"].id,
            human_id="AST-0018",
            hostname="WIN-WS-07",
            name="Operations workstation",
            criticality="high",
            exposure="internal",
            lifecycle="active",
            environment_name="simulated",
            data_classification="internal",
            platform="Windows",
            telemetry_status="reference_only",
            last_seen_at=seen,
        ),
        "WAZUH-01": Asset(
            organization_id=org.id,
            asset_type_id=asset_types["security_platform"].id,
            human_id="AST-0003",
            hostname="WAZUH-01",
            name="Wazuh manager reference",
            criticality="critical",
            exposure="internal",
            lifecycle="active",
            environment_name="simulated",
            data_classification="restricted",
            platform="Linux",
            telemetry_status="not_connected",
            last_seen_at=seen,
        ),
        "LINUX-APP-01": Asset(
            organization_id=org.id,
            asset_type_id=asset_types["linux_server"].id,
            human_id="AST-0061",
            hostname="LINUX-APP-01",
            name="Lab application host",
            criticality="high",
            exposure="internal",
            lifecycle="active",
            environment_name="simulated",
            data_classification="internal",
            platform="Linux",
            telemetry_status="not_connected",
            last_seen_at=seen,
        ),
        "EDGE-FW-01": Asset(
            organization_id=org.id,
            asset_type_id=asset_types["network_device"].id,
            human_id="AST-0031",
            hostname="EDGE-FW-01",
            name="Edge firewall",
            criticality="high",
            exposure="internet",
            lifecycle="active",
            environment_name="simulated",
            data_classification="restricted",
            platform="Network",
            telemetry_status="reference_only",
            last_seen_at=seen,
        ),
    }
    session.add_all(assets.values())
    session.flush()
    session.add(
        AssetOwner(
            asset_id=assets["FIN-APP-01"].id,
            user_id=users["USR-0001"].id,
            owner_label="Amara Okonkwo",
            owner_role="business",
        )
    )
    finance_data = DataAsset(
        organization_id=org.id,
        name="Finance ledger extract",
        classification="restricted",
        description="Simulated data class processed by FIN-APP-01. No records are stored here.",
    )
    session.add(finance_data)
    session.flush()
    session.add(
        AssetDataRelationship(
            asset_id=assets["FIN-APP-01"].id,
            data_asset_id=finance_data.id,
            relationship_kind="processes",
        )
    )

    risk = Risk(
        organization_id=org.id,
        asset_id=assets["FIN-APP-01"].id,
        owner_user_id=users["USR-0003"].id,
        human_id="RISK-0021",
        title="Service exploitation on the finance application",
        statement=(
            "Simulated scenario: FIN-APP-01 remains exposed with a known critical "
            "finding past an internal label."
        ),
        status="open",
        methodology="aegisbridge_likelihood_x_impact",
    )
    session.add(risk)
    session.flush()
    session.add(
        RiskAssessment(
            risk_id=risk.id,
            likelihood=4,
            impact=5,
            is_current=True,
            notes="Internal methodology only. Likelihood and impact are separate inputs.",
        )
    )
    session.add(
        RiskTreatment(
            risk_id=risk.id,
            strategy="mitigate",
            status="planned",
            notes="Simulated treatment. No control change was applied.",
        )
    )

    nist = Framework(code="NIST-800-53", name="NIST SP 800-53")
    session.add(nist)
    session.flush()
    nist_rev = FrameworkVersion(framework_id=nist.id, version_label="Rev. 5", is_current=True)
    session.add(nist_rev)
    session.flush()
    control = Control(
        organization_id=org.id,
        framework_version_id=nist_rev.id,
        human_id="CTRL-0002",
        control_code="AC-2",
        title="Account management",
        family="AC",
    )
    session.add(control)
    session.flush()
    session.add(
        ControlImplementation(
            control_id=control.id,
            owner_user_id=users["USR-0003"].id,
            status="partial",
            notes="Simulated implementation label.",
        )
    )

    evidence_hash = hashlib.sha256(b"EVID-0041 synthetic development evidence").hexdigest()
    evidence = Evidence(
        organization_id=org.id,
        collected_by_user_id=users["USR-0005"].id,
        human_id="EVID-0041",
        title="Privileged account inventory",
        description="Metadata only. The file bytes are not stored in PostgreSQL.",
        version_label="1",
        sha256=evidence_hash,
        size_bytes=0,
        mime_type="text/plain",
        object_uri="s3://aegis-dev-evidence/synthetic/EVID-0041",
        data_classification="simulated",
        collected_at=seen,
    )
    session.add(evidence)
    session.flush()
    session.add(EvidenceControlLink(evidence_id=evidence.id, control_id=control.id))
    session.add(EvidenceRiskLink(evidence_id=evidence.id, risk_id=risk.id))

    cve = CveRecord(
        cve_id="CVE-2024-21887",
        cvss_version="3.1",
        cvss_base_score=9.8,
        cvss_vector="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        summary="Simulated catalog severity for the finance-host finding. Not a live NVD fetch.",
    )
    session.add(cve)
    session.flush()
    session.add(
        EpssSnapshot(
            cve_record_id=cve.id,
            epss=0.94,
            percentile=0.99,
            observed_on=date(2026, 10, 19),
        )
    )
    session.add(
        KevRecord(
            cve_record_id=cve.id,
            date_added=date(2024, 1, 12),
            vulnerability_name="Simulated KEV catalog entry",
            known_ransomware_use="unknown",
        )
    )
    finding = Vulnerability(
        organization_id=org.id,
        cve_record_id=cve.id,
        human_id="VULN-0041",
        title="Known-exploited finding on FIN-APP-01",
    )
    session.add(finding)
    session.flush()
    asset_finding = AssetVulnerability(
        vulnerability_id=finding.id,
        asset_id=assets["FIN-APP-01"].id,
        exposure="internet",
        asset_criticality="critical",
        status="open",
    )
    session.add(asset_finding)
    session.flush()
    session.add(
        SsvcAssessment(
            asset_vulnerability_id=asset_finding.id,
            decision="act",
            rationale=(
                "Simulated decision. CVSS, EPSS, KEV, exposure, and criticality "
                "stay in their own columns."
            ),
        )
    )
    session.add(
        RemediationTask(
            asset_vulnerability_id=asset_finding.id,
            owner_user_id=users["USR-0001"].id,
            title="Patch FIN-APP-01",
            status="open",
            due_on=date(2026, 10, 20),
        )
    )

    technique = AttackTechnique(
        technique_id="T1059.001",
        name="PowerShell",
        tactic="Execution",
        attack_version="Enterprise v20.0",
    )
    session.add(technique)
    session.flush()
    detection = Detection(
        organization_id=org.id,
        human_id="DET-0005",
        name="Suspicious PowerShell child process",
        status="simulated",
    )
    session.add(detection)
    session.flush()
    session.add(
        DetectionVersion(
            detection_id=detection.id,
            version_label="1",
            logic_summary="Reference rule summary only. Not deployed to Wazuh.",
            is_current=True,
        )
    )
    session.add(DetectionAttackMapping(detection_id=detection.id, attack_technique_id=technique.id))

    alert = AlertReference(
        organization_id=org.id,
        asset_id=assets["WIN-WS-07"].id,
        detection_id=detection.id,
        human_id="AL-0107",
        wazuh_alert_id=None,
        severity="high",
        status="new",
        summary="Simulated selected metadata. No raw Wazuh event is stored.",
        telemetry_source="not_connected",
        observed_at=seen,
    )
    session.add(alert)
    session.flush()
    session.add(
        Investigation(
            organization_id=org.id,
            alert_reference_id=alert.id,
            assignee_user_id=users["USR-0004"].id,
            human_id="INV-0012",
            title="Review PowerShell child process",
            status="open",
            summary="Simulated investigation. No confirmed compromise.",
            opened_at=seen,
        )
    )

    incident = Incident(
        organization_id=org.id,
        owner_user_id=users["USR-0004"].id,
        human_id="INC-0001",
        title="Repeated authentication failures",
        severity="medium",
        status="investigating",
        summary="Simulated incident. Severity and status are separate. No confirmed compromise.",
    )
    session.add(incident)
    session.flush()
    session.add(
        IncidentEvent(
            incident_id=incident.id,
            summary="Opened from simulated authentication failures.",
            occurred_at=seen,
        )
    )
    session.add(
        IncidentEvidence(
            incident_id=incident.id,
            evidence_id=evidence.id,
            note="Reference only.",
        )
    )

    vendor = Vendor(
        organization_id=org.id,
        human_id="VEN-0001",
        name="Example Identity Provider",
        status="planned",
    )
    session.add(vendor)
    session.flush()
    session.add(
        VendorService(
            vendor_id=vendor.id,
            name="Directory import",
            description="Not connected.",
        )
    )

    policy = Policy(
        organization_id=org.id,
        owner_user_id=users["USR-0003"].id,
        human_id="POL-0001",
        title="Access control policy",
        status="draft",
    )
    session.add(policy)
    session.flush()
    version = PolicyVersion(
        policy_id=policy.id,
        version_label="0.1",
        body_summary="Simulated policy summary. Full text is not stored.",
        is_current=True,
    )
    session.add(version)
    session.flush()
    session.add(PolicyAcknowledgement(policy_version_id=version.id, user_id=users["USR-0001"].id))

    dataset = Dataset(
        organization_id=org.id,
        human_id="DS-0001",
        name="Smishing IMC25 registry placeholder",
        status="not_downloaded",
        notes="Name only. No dataset file is stored.",
    )
    session.add(dataset)
    session.flush()
    session.add(DatasetVersion(dataset_id=dataset.id, version_label="registry"))

    wazuh = Integration(
        organization_id=org.id,
        name="Wazuh",
        category="siem",
        status="not_configured",
        auth_state="No credentials stored",
        notes="Wazuh remains the system of record. This row is a catalog reference.",
    )
    session.add(wazuh)
    session.flush()
    session.add(SyncState(integration_id=wazuh.id, freshness="not_connected", cursor_label=None))

    session.add(
        AuditEvent(
            organization_id=org.id,
            actor_user_id=users["USR-0001"].id,
            human_id="AUD-0001",
            occurred_at=seen,
            actor_label="USR-0001",
            action="Recorded development seed",
            object_type="organization",
            object_id=ORG_SLUG,
            result="simulated",
            source="seed",
            environment_name="local",
            detail="Synthetic development records. No secret material.",
        )
    )
    _ensure_contract_records(session, org)
    session.commit()


def _ensure_contract_records(session: Session, org: Organization) -> None:
    """Add contract rows that the first seed omitted. Safe to run more than once."""
    seen = datetime(2026, 10, 19, 21, 12, tzinfo=UTC)
    recorded = datetime(2026, 10, 19, 21, 13, tzinfo=UTC)
    security = session.scalar(
        select(Department).where(
            Department.organization_id == org.id,
            Department.name == "Security",
        )
    )
    detection_permission = session.scalar(
        select(Permission).where(Permission.code == "detection.manage")
    )
    if detection_permission is None:
        detection_permission = Permission(
            code="detection.manage",
            description="Label for detection configuration. Not enforced.",
        )
        session.add(detection_permission)
        session.flush()
    integration_permission = session.scalar(
        select(Permission).where(Permission.code == "integration.manage")
    )
    engineer = session.scalar(
        select(Role).where(Role.organization_id == org.id, Role.name == "Security Engineer")
    )
    if engineer is None:
        engineer = Role(
            organization_id=org.id,
            name="Security Engineer",
            summary=(
                "Manages detections, integrations, endpoint and network control "
                "configuration, vulnerability remediation, and technical evidence."
            ),
        )
        session.add(engineer)
        session.flush()

    engineer_user = session.scalar(select(User).where(User.human_id == "USR-0002"))
    if engineer_user is None and security is not None:
        engineer_user = User(
            organization_id=org.id,
            department_id=security.id,
            human_id="USR-0002",
            email="nia.okeke@aegisbridge.example",
            display_name="Nia Okeke",
            job_title="Security engineer",
            account_status="active",
            timezone_name="America/New_York",
        )
        session.add(engineer_user)
        session.flush()
        session.add(UserRole(user_id=engineer_user.id, role_id=engineer.id))
        if integration_permission is not None:
            session.add(
                AccessEntitlement(
                    user_id=engineer_user.id,
                    permission_id=integration_permission.id,
                    grant_source="role_catalog",
                )
            )
        session.add(
            AccessEntitlement(
                user_id=engineer_user.id,
                permission_id=detection_permission.id,
                grant_source="role_catalog",
            )
        )

    wazuh = session.scalar(select(Integration).where(Integration.name == "Wazuh"))
    if wazuh is not None and wazuh.human_id is None:
        wazuh.human_id = "INT-0001"

    if session.scalar(select(Integration).where(Integration.human_id == "INT-0002")) is None:
        identity = Integration(
            organization_id=org.id,
            human_id="INT-0002",
            name="Example identity provider",
            category="identity",
            status="reference_only",
            auth_state="No credentials stored",
            notes=(
                "Catalog reference only. The identity provider is not connected "
                "and no credentials are stored."
            ),
        )
        session.add(identity)
        session.flush()
        session.add(SyncState(integration_id=identity.id, freshness="not_connected"))

    actor = session.scalar(select(User).where(User.human_id == "USR-0001"))
    if session.scalar(select(AuditEvent).where(AuditEvent.human_id == "AUD-0002")) is None:
        session.add(
            AuditEvent(
                organization_id=org.id,
                actor_user_id=None if actor is None else actor.id,
                human_id="AUD-0002",
                occurred_at=recorded,
                actor_label="USR-0001",
                action="Recorded Security Engineer catalog role",
                object_type="role",
                object_id="Security Engineer",
                result="simulated",
                source="seed",
                environment_name="local",
                detail="Role catalog alignment with master requirements. No secret material.",
            )
        )

    sources = _ensure_threat_sources(session, org)
    _ensure_threat_indicators(session, org, sources, seen)
    if session.scalar(select(ThreatAdvisory).where(ThreatAdvisory.human_id == "ADV-0001")) is None:
        session.add(
            ThreatAdvisory(
                organization_id=org.id,
                source_id=sources["SRC-0006"].id,
                human_id="ADV-0001",
                title="Simulated development advisory",
                summary=(
                    "Stored metadata naming CVE-2024-21887. "
                    "NVD was not queried and this is not a live advisory."
                ),
                status="reference",
                confidence="low",
                related_cve="CVE-2024-21887",
                published_at=seen,
            )
        )

    _ensure_report_definitions(session, org)
    datasets = _ensure_datasets(session, org)
    _ensure_dataset_experiments(session, datasets, seen)


def _ensure_report_definitions(session: Session, org: Organization) -> None:
    owner = session.scalar(select(User).where(User.human_id == "USR-0001"))
    grc = session.scalar(select(User).where(User.human_id == "USR-0003"))
    catalog = (
        (
            "RPT-0001",
            "Executive Security Summary",
            "Stored definition for an executive posture summary. No PDF is generated.",
            "executive_security_summary",
            "ready",
            "schedule_defined",
            "Weekly",
            "PDF",
            owner,
        ),
        (
            "RPT-0002",
            "Vulnerability Exposure Report",
            "Stored definition for vulnerability exposure columns. No CSV is generated.",
            "vulnerability_exposure",
            "ready",
            "schedule_defined",
            "Weekly",
            "CSV",
            owner,
        ),
        (
            "RPT-0003",
            "Risk Register Report",
            "Stored definition for the risk register. No export file is generated.",
            "risk_register",
            "ready",
            "not_scheduled",
            None,
            "PDF",
            grc,
        ),
        (
            "RPT-0004",
            "Control Assessment Report",
            "Stored definition for control assessment summaries. CIS licensed text is omitted.",
            "control_assessment",
            "ready",
            "schedule_defined",
            "Monthly",
            "PDF",
            grc,
        ),
        (
            "RPT-0005",
            "Incident Summary Report",
            "Stored definition for incident summaries. No compromise verdict is invented.",
            "incident_summary",
            "review",
            "not_scheduled",
            None,
            "PDF",
            owner,
        ),
    )
    for (
        human_id,
        name,
        description,
        report_type,
        status,
        schedule_state,
        schedule_label,
        format_label,
        user,
    ) in catalog:
        if session.scalar(select(ReportDefinition).where(ReportDefinition.human_id == human_id)):
            continue
        session.add(
            ReportDefinition(
                organization_id=org.id,
                owner_user_id=None if user is None else user.id,
                human_id=human_id,
                name=name,
                description=description,
                report_type=report_type,
                status=status,
                schedule_state=schedule_state,
                schedule_label=schedule_label,
                format_label=format_label,
                last_run_at=None,
                next_run_at=None,
            )
        )


def _ensure_datasets(session: Session, org: Organization) -> dict[str, Dataset]:
    catalog = (
        (
            "DS-0001",
            "Smishing Dataset – IMC25",
            "Registry entry for the IMC25 smishing dataset. No file is stored.",
            "IMC25 project",
            "Publisher catalog",
            2025,
            "Smishing and social engineering",
            "CC BY 4.0",
            "not_downloaded",
            "reviewed",
            "Message analytics and explainable reporting",
            "Lightweight labeled CSV",
            "Name and license label only. The dataset file is not downloaded.",
        ),
        (
            "DS-0002",
            "CICAPT-IIoT2024 subset",
            "Registry entry for a selected CICAPT-IIoT2024 subset. No subset file is stored.",
            "Canadian Institute for Cybersecurity",
            "Publisher catalog",
            2024,
            "IIoT APT detection",
            "Publisher terms",
            "not_downloaded",
            "reviewed",
            "Provenance and ATT&CK-relevant detection research",
            "Selected subset only",
            "Registry metadata only. The subset is not in the repository.",
        ),
        (
            "DS-0003",
            "CICIoT2023",
            "Optional IoT network-attack registry entry. No capture file is stored.",
            "Canadian Institute for Cybersecurity",
            "Publisher catalog",
            2023,
            "IoT network attacks",
            "Publisher terms",
            "not_downloaded",
            "not_reviewed",
            "IDS analytics experiments",
            "Large · subset only",
            "Registry metadata only. Full capture is not downloaded.",
        ),
        (
            "DS-0004",
            "DataSense CIC IIoT 2025",
            "Optional multi-modal IIoT registry entry. No file is stored.",
            "Canadian Institute for Cybersecurity",
            "Publisher catalog",
            2025,
            "IIoT sensor and network",
            "Publisher terms",
            "not_downloaded",
            "not_reviewed",
            "Multi-modal anomaly research",
            "Large · not downloaded",
            "Do not download the full dataset during initial development.",
        ),
        (
            "DS-0005",
            "CIC-Trap4Phish 2025",
            "Optional phishing document and URL registry entry. Attachments are not executed.",
            "Canadian Institute for Cybersecurity",
            "Publisher catalog",
            2025,
            "Phishing documents and URLs",
            "Publisher terms",
            "not_downloaded",
            "not_reviewed",
            "Safe static features. Attachments are not executed.",
            "Static feature subset",
            "Registry metadata only. No attachment bytes are stored.",
        ),
        (
            "DS-0006",
            "PhreshPhish",
            "Optional large-scale phishing registry entry. No sample file is stored.",
            "PhreshPhish project",
            "Publisher catalog",
            2025,
            "Large-scale phishing",
            "CC BY 4.0",
            "not_downloaded",
            "verification_required",
            "Sampled phishing research",
            "About 36.6 GB · sample only",
            "Size label is from published notes. No download and no verification run.",
        ),
        (
            "DS-0007",
            "CIC-PQC_OAV v1",
            "Optional post-quantum TLS registry entry. No session file is stored.",
            "Canadian Institute for Cybersecurity",
            "Publisher catalog",
            2025,
            "TLS and post-quantum operations",
            "Publisher terms",
            "not_downloaded",
            "not_reviewed",
            "Later protocol research",
            "About 40,010 sessions",
            "Session count is a published label. No file is stored.",
        ),
        (
            "DS-0008",
            "CIC-YNU-IoTMal 2026",
            "Optional IoT malware behavior registry entry. Raw binaries are not a dependency.",
            "Canadian Institute for Cybersecurity",
            "Publisher catalog",
            2026,
            "IoT malware behavior",
            "Publisher terms",
            "not_downloaded",
            "verification_required",
            "Derived behavior research. Raw binaries are not a dependency.",
            "Processed features only",
            "Registry metadata only. No malware binary is stored.",
        ),
        (
            "DS-0009",
            "AegisBridge internal telemetry",
            "Local cyber-range telemetry placeholder. The lab host is not connected.",
            "AegisBridge Technologies",
            "Project-owned",
            2026,
            "Lab endpoint and network telemetry",
            "Project-owned",
            "not_downloaded",
            "reviewed",
            "Local validation records. Kept apart from published datasets.",
            "Not collected",
            "No telemetry file is stored. The lab host is not connected.",
        ),
    )
    datasets: dict[str, Dataset] = {}
    for (
        human_id,
        name,
        description,
        publisher,
        source_label,
        year,
        domain,
        license_label,
        status,
        verification_status,
        purpose,
        size_label,
        notes,
    ) in catalog:
        row = session.scalar(select(Dataset).where(Dataset.human_id == human_id))
        if row is None:
            row = Dataset(
                organization_id=org.id,
                human_id=human_id,
                name=name,
                status=status,
            )
            session.add(row)
            session.flush()
            session.add(DatasetVersion(dataset_id=row.id, version_label="registry"))
        row.name = name
        row.description = description
        row.publisher = publisher
        row.source_label = source_label
        row.source_url = None
        row.publication_year = year
        row.domain = domain
        row.license_label = license_label
        row.status = status
        row.verification_status = verification_status
        row.purpose = purpose
        row.size_label = size_label
        row.row_count = None
        row.feature_count = None
        row.notes = notes
        datasets[human_id] = row
    return datasets


def _ensure_dataset_experiments(
    session: Session,
    datasets: dict[str, Dataset],
    seen: datetime,
) -> None:
    catalog = (
        (
            "RSCH-0001",
            "DS-0001",
            "Smishing lure categories",
            "completed",
            "classification_summary",
            "Manual category tabulation",
            "Category counts were tabulated from the registry note. No model runtime was used.",
            seen,
            seen,
            "Completed metadata only. No model artifact is stored.",
        ),
        (
            "RSCH-0002",
            "DS-0002",
            "IIoT subset provenance check",
            "completed",
            "manifest_review",
            "Manifest field review",
            "Manifest fields are recorded. The subset is not in the repository.",
            seen,
            seen,
            "Completed metadata only. No detection comparison was run.",
        ),
        (
            "RSCH-0003",
            "DS-0009",
            "Range telemetry freshness",
            "completed",
            "telemetry_review",
            "Simulated validation comparison",
            "Three simulated runs are on record. The lab host is not connected.",
            seen,
            seen,
            "Completed metadata only. No live range connection exists.",
        ),
        (
            "RSCH-0004",
            "DS-0005",
            "Static phishing features",
            "planned",
            "static_feature_review",
            "Static-feature plan",
            None,
            None,
            None,
            "Not started. No download and no execution.",
        ),
    )
    for (
        human_id,
        dataset_id,
        name,
        status,
        experiment_type,
        approach,
        metrics,
        started_at,
        completed_at,
        notes,
    ) in catalog:
        if session.scalar(select(DatasetExperiment).where(DatasetExperiment.human_id == human_id)):
            continue
        dataset = datasets.get(dataset_id)
        if dataset is None:
            continue
        version = session.scalar(
            select(DatasetVersion).where(
                DatasetVersion.dataset_id == dataset.id,
                DatasetVersion.version_label == "registry",
            )
        )
        if version is None:
            continue
        session.add(
            DatasetExperiment(
                dataset_version_id=version.id,
                human_id=human_id,
                name=name,
                status=status,
                experiment_type=experiment_type,
                approach=approach,
                metrics_summary=metrics,
                started_at=started_at,
                completed_at=completed_at,
                notes=notes,
            )
        )


def _ensure_threat_sources(session: Session, org: Organization) -> dict[str, ThreatIntelSource]:
    catalog = (
        (
            "SRC-0001",
            "CISA KEV",
            "cisa",
            "Known exploited vulnerabilities catalog name.",
            "reference_only",
            "Catalog name only. The KEV feed is not connected.",
        ),
        (
            "SRC-0002",
            "NVD",
            "nvd",
            "National Vulnerability Database catalog name.",
            "not_connected",
            "Catalog name only. The NVD feed is not connected.",
        ),
        (
            "SRC-0003",
            "EPSS",
            "first",
            "Exploit prediction score catalog name.",
            "not_connected",
            "Catalog name only. The EPSS feed is not connected.",
        ),
        (
            "SRC-0004",
            "ThreatFox",
            "abuse.ch",
            "Indicator catalog name.",
            "not_connected",
            "Catalog name only. The ThreatFox feed is not connected.",
        ),
        (
            "SRC-0005",
            "URLhaus",
            "abuse.ch",
            "Malicious URL catalog name.",
            "not_connected",
            "Catalog name only. The URLhaus feed is not connected.",
        ),
        (
            "SRC-0006",
            "Internal simulated set",
            "internal",
            "Development indicators stored in PostgreSQL.",
            "reference_only",
            "Development indicators stored in PostgreSQL. Not a live feed.",
        ),
    )
    sources: dict[str, ThreatIntelSource] = {}
    for human_id, name, provider, purpose, status, notes in catalog:
        row = session.scalar(
            select(ThreatIntelSource).where(ThreatIntelSource.human_id == human_id)
        )
        if row is None:
            row = ThreatIntelSource(
                organization_id=org.id,
                human_id=human_id,
                name=name,
                provider=provider,
                purpose=purpose,
                connection_status=status,
                notes=notes,
            )
            session.add(row)
            session.flush()
        sources[human_id] = row
    return sources


def _ensure_threat_indicators(
    session: Session,
    org: Organization,
    sources: dict[str, ThreatIntelSource],
    seen: datetime,
) -> None:
    if session.scalar(select(ThreatIndicator).where(ThreatIndicator.human_id == "IOC-0001")):
        return
    asset = session.scalar(select(Asset).where(Asset.human_id == "AST-0007"))
    technique = session.scalar(
        select(AttackTechnique).where(AttackTechnique.technique_id == "T1059.001")
    )
    digest = hashlib.sha256(b"AegisBridge simulated threat indicator IOC-0003").hexdigest()
    internal = sources["SRC-0006"]
    session.add_all(
        [
            ThreatIndicator(
                organization_id=org.id,
                source_id=internal.id,
                human_id="IOC-0001",
                indicator_type="ip",
                value="203.0.113.50",
                confidence="low",
                severity="low",
                status="active",
                internal_match=False,
                first_seen=seen,
                last_seen=seen,
                summary="TEST-NET-3 address reserved for documentation. Simulated indicator.",
            ),
            ThreatIndicator(
                organization_id=org.id,
                source_id=internal.id,
                matched_asset_id=None if asset is None else asset.id,
                attack_technique_id=None if technique is None else technique.id,
                human_id="IOC-0002",
                indicator_type="domain",
                value="dev-watch.example",
                confidence="medium",
                severity="medium",
                status="active",
                internal_match=True,
                first_seen=seen,
                last_seen=seen,
                summary=(
                    "Stored simulated internal-match label for AST-0007 and ATT&CK T1059.001. "
                    "Not a live correlation and not a confirmed compromise."
                ),
            ),
            ThreatIndicator(
                organization_id=org.id,
                source_id=internal.id,
                human_id="IOC-0003",
                indicator_type="file_hash",
                value=digest,
                confidence="low",
                severity=None,
                status="expired",
                internal_match=False,
                first_seen=seen,
                last_seen=seen,
                summary="SHA-256 of a labeled synthetic string. Not a file from a live feed.",
            ),
        ]
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Load deterministic development domain seed.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete domain rows first. Allowed only when APP_ENV is local.",
    )
    args = parser.parse_args()
    with SessionLocal() as session:
        if args.reset:
            reset_domain_tables(session)
        seed_development(session)


if __name__ == "__main__":
    main()
