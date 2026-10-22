"""Domain metadata, constraints, Alembic cycle, and development seed."""

from __future__ import annotations

import os
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import SessionLocal, engine
from app.db.seed import seed_development
from app.models import (
    Asset,
    Base,
    CveRecord,
    Department,
    EpssSnapshot,
    Evidence,
    KevRecord,
    Organization,
    Risk,
    RiskAssessment,
    Role,
    SsvcAssessment,
    Vulnerability,
)

ROOT = Path(__file__).resolve().parents[3]
BASELINE = "20261020_0001"

REQUIRED_TABLES = {
    "organizations",
    "departments",
    "business_processes",
    "users",
    "roles",
    "permissions",
    "user_roles",
    "access_entitlements",
    "access_reviews",
    "access_review_findings",
    "assets",
    "asset_types",
    "asset_owners",
    "software_products",
    "asset_software",
    "data_assets",
    "asset_data_relationships",
    "risks",
    "risk_assessments",
    "risk_treatments",
    "risk_reviews",
    "frameworks",
    "framework_versions",
    "controls",
    "control_mappings",
    "control_implementations",
    "control_tests",
    "evidence",
    "evidence_control_links",
    "evidence_risk_links",
    "vulnerabilities",
    "cve_records",
    "asset_vulnerabilities",
    "epss_snapshots",
    "kev_records",
    "ssvc_assessments",
    "remediation_tasks",
    "vulnerability_exceptions",
    "detections",
    "detection_versions",
    "attack_techniques",
    "detection_attack_mappings",
    "validation_runs",
    "alert_references",
    "investigations",
    "incidents",
    "incident_events",
    "incident_tasks",
    "incident_indicators",
    "incident_evidence",
    "vendors",
    "vendor_services",
    "vendor_assessments",
    "vendor_findings",
    "policies",
    "policy_versions",
    "policy_acknowledgements",
    "policy_control_mappings",
    "datasets",
    "dataset_versions",
    "dataset_files",
    "dataset_experiments",
    "integrations",
    "sync_jobs",
    "sync_states",
    "audit_events",
    "threat_intel_sources",
    "threat_indicators",
    "threat_advisories",
    "report_definitions",
    "lab_zones",
    "lab_systems",
    "lab_scenarios",
    "lab_scenario_systems",
    "lab_scenario_detections",
    "lab_scenario_attack_mappings",
    "user_credentials",
    "sessions",
}

SECRET_COLUMN_NAMES = {"password", "secret", "token", "api_key", "credential"}
COMBINED_SCORE_NAMES = {
    "combined_score",
    "security_score",
    "vulnerability_score",
    "threat_score",
    "maturity_score",
}


def test_metadata_imports_required_tables() -> None:
    assert set(Base.metadata.tables) >= REQUIRED_TABLES
    assert "updated_at" not in Base.metadata.tables["audit_events"].columns
    for table in Base.metadata.tables.values():
        names = {column.name for column in table.columns}
        assert names.isdisjoint(SECRET_COLUMN_NAMES)
        assert names.isdisjoint(COMBINED_SCORE_NAMES)


def _column_names(table: str) -> set[str]:
    return {column.name for column in Base.metadata.tables[table].columns}


def test_vulnerability_factors_live_on_separate_tables() -> None:
    cve = _column_names("cve_records")
    finding = _column_names("vulnerabilities")
    epss = _column_names("epss_snapshots")
    kev = _column_names("kev_records")
    asset_finding = _column_names("asset_vulnerabilities")
    decision = _column_names("ssvc_assessments")

    assert {"cvss_base_score", "cvss_vector"} <= cve
    assert "cvss_base_score" not in finding
    assert "epss" in epss
    assert "epss" not in cve
    assert "epss" not in finding
    assert "date_added" in kev
    assert "decision" in decision
    assert "score" not in decision
    assert {"exposure", "asset_criticality"} <= asset_finding
    assert "score" not in asset_finding


def test_human_ids_are_unique_and_foreign_keys_exist() -> None:
    for name in (
        "assets",
        "risks",
        "controls",
        "vulnerabilities",
        "detections",
        "incidents",
        "evidence",
        "policies",
        "vendors",
        "audit_events",
    ):
        column = Base.metadata.tables[name].columns["human_id"]
        assert column.unique is True
    risk_asset = {fk.target_fullname for fk in Base.metadata.tables["risks"].foreign_keys}
    assert "assets.id" in risk_asset
    evidence_links = Base.metadata.tables["evidence_control_links"].foreign_keys
    assert {fk.column.table.name for fk in evidence_links} == {"evidence", "controls"}
    policy_control_links = Base.metadata.tables["policy_control_mappings"].foreign_keys
    assert {fk.column.table.name for fk in policy_control_links} == {"policies", "controls"}


def _alembic_config() -> Config:
    return Config(str(ROOT / "alembic.ini"))


def test_alembic_cycle_and_development_seed() -> None:
    previous = Path.cwd()
    os.chdir(ROOT)
    try:
        config = _alembic_config()
        command.upgrade(config, "head")
        command.downgrade(config, BASELINE)
        assert "organizations" not in inspect(engine).get_table_names()
        command.upgrade(config, "head")
        assert set(inspect(engine).get_table_names()) >= REQUIRED_TABLES
        with SessionLocal() as session:
            seed_development(session)
            _assert_seed(session)
            _assert_constraints(session)
    finally:
        command.upgrade(_alembic_config(), "head")
        os.chdir(previous)


def _assert_seed(session: Session) -> None:
    org = session.scalar(
        select(Organization).where(Organization.slug == "aegisbridge-technologies")
    )
    assert org is not None
    assert org.name == "AegisBridge Technologies"
    roles = set(session.scalars(select(Role.name)).all())
    assert {
        "Administrator",
        "CISO",
        "GRC Analyst",
        "SOC Analyst",
        "Auditor",
        "Read Only",
        "Security Engineer",
    } <= roles
    assets = {row.hostname: row.human_id for row in session.scalars(select(Asset)).all()}
    assert assets["FIN-APP-01"] == "AST-0007"
    assert assets["WIN-WS-07"] == "AST-0018"
    assert assets["WAZUH-01"] == "AST-0003"
    assert assets["LINUX-APP-01"] == "AST-0061"
    assert assets["EDGE-FW-01"] == "AST-0031"
    assessment = session.scalar(
        select(RiskAssessment).join(Risk).where(Risk.human_id == "RISK-0021")
    )
    assert assessment is not None
    assert assessment.likelihood == 4
    assert assessment.impact == 5
    assert assessment.score == 20
    assert assessment.residual_score is None
    evidence = session.scalar(select(Evidence).where(Evidence.human_id == "EVID-0041"))
    assert evidence is not None
    assert evidence.sha256 is not None
    assert len(evidence.sha256) == 64
    assert evidence.size_bytes == 0
    assert evidence.object_uri is not None
    cve = session.scalar(select(CveRecord).where(CveRecord.cve_id == "CVE-2024-21887"))
    assert cve is not None
    assert cve.cvss_base_score == Decimal("9.8")
    epss = session.scalar(select(EpssSnapshot).where(EpssSnapshot.cve_record_id == cve.id))
    assert epss is not None
    assert session.scalar(select(KevRecord).where(KevRecord.cve_record_id == cve.id)) is not None
    finding = session.scalar(select(Vulnerability).where(Vulnerability.human_id == "VULN-0041"))
    assert finding is not None
    decision = session.scalar(select(SsvcAssessment))
    assert decision is not None
    assert decision.decision == "act"


def _assert_constraints(session: Session) -> None:
    original = session.scalar(select(Asset).where(Asset.human_id == "AST-0007"))
    assert original is not None
    session.add(
        Asset(
            organization_id=original.organization_id,
            asset_type_id=original.asset_type_id,
            human_id="AST-0007",
            hostname="DUP-HOST",
            name="Duplicate human id",
            criticality=original.criticality,
            exposure=original.exposure,
            lifecycle=original.lifecycle,
            environment_name=original.environment_name,
            data_classification=original.data_classification,
            telemetry_status=original.telemetry_status,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()

    session.add(Department(organization_id=uuid4(), name="Orphan department"))
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()

    risk = session.scalar(select(Risk).where(Risk.human_id == "RISK-0021"))
    assert risk is not None
    session.add(RiskAssessment(risk_id=risk.id, likelihood=6, impact=1))
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()

    evidence = session.scalar(select(Evidence).where(Evidence.human_id == "EVID-0041"))
    assert evidence is not None
    evidence.sha256 = "not-a-sha256"
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()
