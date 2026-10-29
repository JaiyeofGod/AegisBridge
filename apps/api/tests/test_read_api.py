"""Read-only API contracts against the development seed."""

import re
from datetime import UTC, date, datetime
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.vulnerability import CveRecord, EpssSnapshot, KevRecord

UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
FORBIDDEN_KEYS = {
    "security_score",
    "vulnerability_score",
    "combined_score",
    "threat_score",
    "maturity_score",
    "object_uri",
    "storage_uri",
    "password",
    "secret",
    "token",
    "api_key",
    "database_url",
    "auth_state",
}
READ_PATHS = [
    "/api/v1/overview",
    "/api/v1/assets",
    "/api/v1/assets/{asset_id}",
    "/api/v1/risks",
    "/api/v1/risks/{risk_id}",
    "/api/v1/vulnerabilities",
    "/api/v1/vulnerabilities/{vulnerability_id}",
    "/api/v1/alerts",
    "/api/v1/alerts/{alert_id}",
    "/api/v1/incidents",
    "/api/v1/incidents/{incident_id}",
    "/api/v1/incidents/{incident_id}/tasks",
    "/api/v1/incidents/{incident_id}/tasks/{task_id}",
    "/api/v1/governance/summary",
    "/api/v1/threat-intelligence/summary",
    "/api/v1/threat-intelligence/indicators",
    "/api/v1/threat-intelligence/indicators/{indicator_id}",
    "/api/v1/threat-intelligence/advisories",
    "/api/v1/threat-intelligence/sources",
    "/api/v1/attack/tactics",
    "/api/v1/attack/techniques",
    "/api/v1/attack/techniques/{technique_id}",
    "/api/v1/administration/summary",
    "/api/v1/administration/integrations",
    "/api/v1/administration/users",
    "/api/v1/administration/roles",
    "/api/v1/administration/audit-events",
    "/api/v1/administration/access-reviews",
    "/api/v1/reports/summary",
    "/api/v1/reports/definitions",
    "/api/v1/reports/definitions/{report_id}",
    "/api/v1/datasets",
    "/api/v1/datasets/{dataset_id}",
    "/api/v1/dataset-experiments",
    "/api/v1/dataset-experiments/{experiment_id}",
    "/api/v1/cyber-range/summary",
    "/api/v1/cyber-range/zones",
    "/api/v1/cyber-range/systems",
    "/api/v1/cyber-range/systems/{system_id}",
    "/api/v1/cyber-range/system-relationships",
    "/api/v1/cyber-range/scenarios",
    "/api/v1/cyber-range/scenarios/{scenario_id}",
    "/api/v1/cyber-range/telemetry",
    "/api/v1/cyber-range/detections",
]


DEV_PASSWORD = "Dev-Only-Local-Password-1!"
ADMIN_EMAIL = "amara.okonkwo@aegisbridge.example"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    application = create_app()
    with TestClient(application) as test_client:
        login = test_client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL, "password": DEV_PASSWORD},
        )
        assert login.status_code == 200
        yield test_client
    get_settings.cache_clear()


def test_overview_counts_without_a_security_score(client: TestClient) -> None:
    body = client.get("/api/v1/overview").json()
    assert body["organization_name"] == "AegisBridge Technologies"
    assert body["data_origin"] == "simulated"
    assert body["kev_exposure"]["exposed_asset_count"] == 1
    assert body["kev_exposure"]["distinct_cve_count"] == 1
    assert body["kev_exposure"]["asset_ids"] == ["AST-0007"]
    assert body["kev_exposure"]["cve_ids"] == ["CVE-2024-21887"]
    assert body["open_incidents"] == 1
    assert body["control_posture"]["passed"] == 0
    assert body["control_posture"]["assessed_applicable"] == 1
    assert body["telemetry"]["active"] == 0
    assert body["telemetry"]["expected"] == 5
    kinds = {item["kind"] for item in body["my_work"]}
    assert {"remediation", "risk", "incident", "investigation", "access_review"} <= kinds
    assert body["security_highlights"]
    assert body["executive_notes"]
    assert_safe(body)


def test_asset_list_detail_and_filters(client: TestClient) -> None:
    listed = client.get("/api/v1/assets", params={"search": "FIN-APP", "criticality": "critical"})
    assert listed.status_code == 200
    page = listed.json()
    assert page["total"] == 1
    assert page["items"][0]["id"] == "AST-0007"
    assert page["items"][0]["hostname"] == "FIN-APP-01"
    typed = client.get("/api/v1/assets", params={"asset_type": "network_device"}).json()
    assert [item["hostname"] for item in typed["items"]] == ["EDGE-FW-01"]
    quiet = client.get("/api/v1/assets", params={"telemetry_status": "not_connected"}).json()
    assert {item["hostname"] for item in quiet["items"]} == {"WAZUH-01", "LINUX-APP-01"}
    detail = client.get("/api/v1/assets/AST-0007")
    assert detail.status_code == 200
    asset = detail.json()
    assert asset["vulnerabilities"][0]["id"] == "VULN-0041"
    assert asset["risks"][0]["id"] == "RISK-0021"
    assert asset["controls"][0]["id"] == "CTRL-0002"
    assert asset["evidence"][0]["id"] == "EVID-0041"
    assert asset["alerts"] == []
    assert_safe(asset)


def test_risk_list_and_detail_keep_factors_separate(client: TestClient) -> None:
    listed = client.get(
        "/api/v1/risks",
        params={"risk_level": "critical", "treatment_status": "planned", "owner": "Priya"},
    ).json()
    assert listed["total"] == 1
    item = listed["items"][0]
    assert item["id"] == "RISK-0021"
    assert item["likelihood"] == 4
    assert item["impact"] == 5
    assert item["score"] == 20
    assert item["methodology"] == "aegisbridge_likelihood_x_impact"
    assert "NIST-mandated" in item["methodology_label"]
    assert client.get("/api/v1/risks", params={"risk_level": "low"}).json()["total"] == 0
    detail = client.get("/api/v1/risks/RISK-0021").json()
    assert detail["asset_hostname"] == "FIN-APP-01"
    assert detail["evidence"][0]["id"] == "EVID-0041"
    assert detail["residual_score"] is None
    assert_safe(detail)


def test_vulnerability_factors_stay_separate(client: TestClient) -> None:
    listed = client.get(
        "/api/v1/vulnerabilities",
        params={
            "search": "21887",
            "severity": "critical",
            "kev": "true",
            "action_decision": "act",
            "remediation_status": "open",
            "asset_criticality": "critical",
        },
    ).json()
    assert listed["total"] == 1
    item = listed["items"][0]
    assert item["id"] == "VULN-0041"
    assert item["cvss_base_score"] == 9.8
    assert item["epss"] == pytest.approx(0.94)
    assert item["kev_listed"] is True
    assert item["assets"][0]["exposure"] == "internet"
    assert item["assets"][0]["asset_criticality"] == "critical"
    assert item["assets"][0]["action_decision"] == "act"
    assert item["assets"][0]["remediation_status"] == "open"
    assert item["assets"][0]["due_on"] == "2026-10-20"
    assert item["assets"][0]["mitigating_controls"][0]["id"] == "CTRL-0002"
    assert "score" not in item
    detail = client.get("/api/v1/vulnerabilities/VULN-0041").json()
    assert detail["cve_summary"]
    assert "score" not in detail
    assert "intelligence" not in item
    assert detail["intelligence"]["nvd"]["fetched_at"] is None
    assert detail["intelligence"]["kev"]["due_on"] is None
    assert detail["intelligence"]["epss"]["observed_on"] == "2026-10-19"
    assert detail["intelligence"]["epss"]["fetched_at"] is None
    assert_safe(detail)


def test_vulnerability_detail_exposes_stored_provenance(client: TestClient) -> None:
    published = datetime(2024, 1, 16, 12, 0, tzinfo=UTC)
    modified = datetime(2026, 2, 1, 8, 30, tzinfo=UTC)
    nvd_fetched = datetime(2026, 10, 24, 5, 0, tzinfo=UTC)
    kev_checked = datetime(2026, 10, 24, 5, 1, tzinfo=UTC)
    older_fetched = datetime(2020, 1, 2, tzinfo=UTC)
    selected_fetched = datetime(2026, 10, 23, 6, 0, tzinfo=UTC)
    with SessionLocal() as session:
        cve = session.scalar(select(CveRecord).where(CveRecord.cve_id == "CVE-2024-21887"))
        assert cve is not None
        cve.published_at = published
        cve.source_modified_at = modified
        cve.nvd_fetched_at = nvd_fetched
        cve.kev_checked_at = kev_checked
        kev = session.scalar(select(KevRecord).where(KevRecord.cve_record_id == cve.id))
        assert kev is not None
        kev.due_on = date(2024, 1, 31)
        kev.required_action = "Apply the vendor update."
        kev.vendor_project = "Ivanti"
        kev.product = "Connect Secure"
        current = session.scalar(
            select(EpssSnapshot).where(
                EpssSnapshot.cve_record_id == cve.id,
                EpssSnapshot.observed_on == date(2026, 10, 19),
            )
        )
        assert current is not None
        current.fetched_at = selected_fetched
        session.add(
            EpssSnapshot(
                cve_record_id=cve.id,
                epss=0.1,
                percentile=0.2,
                observed_on=date(2020, 1, 1),
                fetched_at=older_fetched,
            )
        )
        session.commit()

    detail = client.get("/api/v1/vulnerabilities/VULN-0041").json()
    listed = client.get("/api/v1/vulnerabilities", params={"search": "21887"}).json()["items"][0]
    assert "intelligence" not in listed
    assert listed["cvss_base_score"] == 9.8
    assert listed["epss"] == pytest.approx(0.94)
    assert listed["kev_listed"] is True
    assert listed["kev_date_added"] == "2024-01-12"
    assert listed["known_ransomware_use"] == "unknown"
    assert detail["cvss_base_score"] == 9.8
    assert detail["epss"] == pytest.approx(0.94)
    assert detail["epss_percentile"] == pytest.approx(0.99)
    assert detail["epss_observed_on"] == "2026-10-19"
    assert detail["kev_listed"] is True
    assert detail["assets"][0]["action_decision"] == "act"
    assert detail["assets"][0]["remediation_status"] == "open"
    assert detail["assets"][0]["due_on"] == "2026-10-20"
    nvd = detail["intelligence"]["nvd"]
    assert nvd["published_at"].startswith("2024-01-16T12:00:00")
    assert nvd["source_modified_at"].startswith("2026-02-01T08:30:00")
    assert nvd["fetched_at"].startswith("2026-10-24T05:00:00")
    kev_body = detail["intelligence"]["kev"]
    assert kev_body["checked_at"].startswith("2026-10-24T05:01:00")
    assert kev_body["due_on"] == "2024-01-31"
    assert kev_body["required_action"] == "Apply the vendor update."
    assert kev_body["vendor_project"] == "Ivanti"
    assert kev_body["product"] == "Connect Secure"
    assert detail["intelligence"]["epss"]["observed_on"] == "2026-10-19"
    assert detail["intelligence"]["epss"]["fetched_at"].startswith("2026-10-23T06:00:00")
    encoded = str(detail).lower()
    assert "api_key" not in encoded
    assert "services.nvd.nist.gov" not in encoded
    assert "cisa.gov" not in encoded
    assert "api.first.org" not in encoded
    assert_safe(detail)


def test_alert_reference_is_metadata_only(client: TestClient) -> None:
    listed = client.get(
        "/api/v1/alerts",
        params={
            "severity": "high",
            "status": "new",
            "asset": "WIN-WS-07",
            "attack_technique": "T1059.001",
        },
    ).json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == "AL-0107"
    detail = client.get("/api/v1/alerts/AL-0107").json()
    assert detail["wazuh_alert_id"] is None
    assert detail["stored_scope"] == "selected_metadata"
    assert detail["source_of_record"] == "wazuh"
    assert detail["telemetry_source"] == "not_connected"
    assert detail["detection_id"] == "DET-0005"
    assert detail["investigation_id"] == "INV-0012"
    assert "raw_event" not in detail
    assert_safe(detail)


def test_incident_detail_uses_empty_states(client: TestClient) -> None:
    listed = client.get(
        "/api/v1/incidents",
        params={
            "search": "authentication",
            "severity": "medium",
            "status": "investigating",
            "owner": "Jonah",
        },
    ).json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == "INC-0001"
    assert listed["items"][0]["containment_state"] is None
    hidden = client.get("/api/v1/incidents", params={"containment_state": "contained"}).json()
    assert hidden["total"] == 0
    detail = client.get("/api/v1/incidents/INC-0001").json()
    assert detail["timeline"]
    assert [task["id"] for task in detail["tasks"]] == ["TASK-0001", "TASK-0002", "TASK-0003"]
    assert listed["items"][0]["open_task_count"] == 3
    assert detail["indicators"] == []
    assert detail["evidence"][0]["id"] == "EVID-0041"
    assert detail["evidence"][0]["sha256"]
    assert detail["related_alerts"] == []
    assert detail["affected_assets"] == []
    assert "No confirmed compromise" in detail["summary"]
    assert_safe(detail)


def test_governance_summary_omits_licensed_text(client: TestClient) -> None:
    body = client.get("/api/v1/governance/summary").json()
    framework = body["frameworks"][0]
    assert framework["code"] == "NIST-800-53"
    assert framework["version"] == "Rev. 5"
    assert framework["licensed_text_included"] is False
    assert body["control_implementations"]["by_status"].get("partial", 0) >= 1
    assert body["control_implementations"]["tests_passed"] >= 0
    assert body["evidence_freshness"]["with_sha256"] >= 1
    assert body["assessment_work"]["tests_recorded"] >= 0
    assert body["policies"][0]["id"] == "POL-0001"
    assert body["policies"][0]["status"] == "published"
    assert body["access_reviews"][0]["id"] == "ARV-0001"
    assert body["access_reviews"][0]["open_findings"] == 1
    assert_safe(body)


def test_pagination_and_validation_and_not_found(client: TestClient) -> None:
    page = client.get("/api/v1/assets", params={"page": 2, "page_size": 1}).json()
    assert page["page"] == 2
    assert page["page_size"] == 1
    assert page["total"] == 5
    assert len(page["items"]) == 1
    invalid = client.get("/api/v1/assets", params={"page_size": 101})
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "validation_error"
    assert invalid.json()["request_id"] is None
    missing = client.get("/api/v1/assets/AST-9999")
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"
    assert missing.json()["details"] is None
    bad_level = client.get("/api/v1/risks", params={"risk_level": "extreme"})
    assert bad_level.status_code == 422
    assert bad_level.json()["code"] == "validation_error"


def test_threat_intelligence_is_simulated_reference_data(client: TestClient) -> None:
    summary = client.get("/api/v1/threat-intelligence/summary").json()
    assert summary["active_indicator_count"] == 2
    assert summary["internal_match_count"] == 1
    assert summary["advisory_count"] == 1
    assert summary["source_health"] == {"reference_only": 2, "not_connected": 4}
    assert summary["data_origin"] == "simulated"
    assert "not connected" in summary["semantics"]
    assert_safe(summary)

    listed = client.get(
        "/api/v1/threat-intelligence/indicators",
        params={"source": "SRC-0006", "status": "active"},
    ).json()
    assert listed["page_size"] == 25
    assert listed["total"] == 2
    assert {item["id"] for item in listed["items"]} == {"IOC-0001", "IOC-0002"}
    reserved = client.get(
        "/api/v1/threat-intelligence/indicators",
        params={"search": "203.0.113", "indicator_type": "ip"},
    ).json()
    assert reserved["total"] == 1
    assert reserved["items"][0]["value"] == "203.0.113.50"
    assert reserved["items"][0]["internal_match"] is False
    matched = client.get(
        "/api/v1/threat-intelligence/indicators",
        params={
            "indicator_type": "domain",
            "internal_match": True,
            "source": "Internal simulated set",
        },
    ).json()
    assert matched["total"] == 1
    assert matched["items"][0]["id"] == "IOC-0002"
    expired = client.get(
        "/api/v1/threat-intelligence/indicators",
        params={"status": "expired"},
    ).json()
    assert expired["total"] == 1
    assert expired["items"][0]["id"] == "IOC-0003"
    assert_safe(listed)
    assert_safe(reserved)
    assert_safe(matched)
    assert_safe(expired)

    detail = client.get("/api/v1/threat-intelligence/indicators/IOC-0002").json()
    assert detail["attack_technique_id"] == "T1059.001"
    assert detail["attack"]["technique_id"] == "T1059.001"
    assert detail["matched_asset_id"] == "AST-0007"
    assert detail["source"]["connection_status"] == "reference_only"
    assert "not a confirmed compromise" in detail["summary"].lower()
    assert detail["data_origin"] == "simulated"
    assert_safe(detail)
    missing = client.get("/api/v1/threat-intelligence/indicators/IOC-9999")
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"
    invalid = client.get(
        "/api/v1/threat-intelligence/indicators",
        params={"indicator_type": "email"},
    )
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "validation_error"

    advisories = client.get("/api/v1/threat-intelligence/advisories").json()
    assert advisories["total"] == 1
    assert advisories["items"][0]["id"] == "ADV-0001"
    assert advisories["items"][0]["related_cve"] == "CVE-2024-21887"
    assert "not queried" in advisories["items"][0]["summary"].lower()
    assert_safe(advisories)

    sources = client.get("/api/v1/threat-intelligence/sources").json()
    by_id = {item["id"]: item for item in sources["items"]}
    assert set(by_id) == {f"SRC-000{index}" for index in range(1, 7)}
    assert {item["connection_status"] for item in sources["items"]} == {
        "reference_only",
        "not_connected",
    }
    for item in sources["items"]:
        assert item["connection_status"] not in {"configured", "healthy", "delayed"}
        assert (
            "not connected" in item["notes"].lower() or "not a live feed" in item["notes"].lower()
        )
    assert "not connected" in by_id["SRC-0001"]["notes"].lower()
    assert by_id["SRC-0001"]["name"] == "CISA KEV"
    assert_safe(sources)


def test_administration_catalog_omits_secrets(client: TestClient) -> None:
    inside_window = datetime(2026, 10, 20, 21, 13, tzinfo=UTC)
    # Far enough ahead that seed rows and LOGIN_* rows from this suite fall outside
    # the recent-audit window (RECENT_AUDIT_DAYS).
    outside_window = datetime(2027, 12, 1, 0, 0, tzinfo=UTC)
    with patch("app.services.administration.datetime") as clock:
        clock.now.return_value = inside_window
        summary = client.get("/api/v1/administration/summary").json()
        clock.now.return_value = outside_window
        aged = client.get("/api/v1/administration/summary").json()
    assert summary["configured_integration_count"] == 0
    assert summary["integration_status"]["not_configured"] == 1
    assert summary["integration_status"]["reference_only"] == 1
    assert summary["integration_status"]["not_connected"] == 1
    assert summary["integration_freshness"] == {"not_connected": 3}
    assert summary["active_user_count"] >= 5
    assert summary["privileged_user_count"] >= 2
    # Seed contributes two catalog audit rows; authenticated fixture login and
    # other suites may append LOGIN_* events in the shared development database.
    assert summary["recent_audit_event_count"] >= 2
    assert aged["recent_audit_event_count"] == 0
    assert summary["pending_access_review_count"] == 1
    assert summary["privileged_roles"] == ["Administrator", "Security Engineer"]
    assert "not_connected" in summary["semantics"]
    assert_safe(summary)

    integrations = client.get("/api/v1/administration/integrations").json()
    by_id = {item["id"]: item for item in integrations["items"]}
    assert set(by_id) == {"INT-0001", "INT-0002", "INT-0003"}
    assert by_id["INT-0001"]["status"] == "not_configured"
    assert by_id["INT-0001"]["freshness"] == "not_connected"
    assert by_id["INT-0001"]["last_sync_at"] is None
    assert by_id["INT-0001"]["last_success_at"] is None
    assert by_id["INT-0002"]["status"] == "reference_only"
    assert by_id["INT-0003"]["name"] == "Lab Bridge"
    assert by_id["INT-0003"]["status"] == "not_connected"
    assert by_id["INT-0003"]["freshness"] == "not_connected"
    for item in integrations["items"]:
        assert item["credential_state"] == "No credentials stored"
    assert_safe(integrations)

    users = client.get("/api/v1/administration/users", params={"page_size": 25}).json()
    assert users["total"] >= 5
    by_user = {item["id"]: item for item in users["items"]}
    assert by_user["USR-0001"]["privileged"] is True
    assert by_user["USR-0001"]["roles"] == ["Administrator"]
    assert by_user["USR-0002"]["display_name"] == "Nia Okeke"
    assert by_user["USR-0002"]["email"] == "nia.okeke@aegisbridge.example"
    assert by_user["USR-0002"]["department"] == "Security"
    assert by_user["USR-0002"]["roles"] == ["Security Engineer"]
    assert by_user["USR-0002"]["privileged"] is True
    assert by_user["USR-0004"]["privileged"] is False
    assert_safe(users)
    window = client.get("/api/v1/administration/users", params={"page": 2, "page_size": 1})
    assert window.status_code == 200
    assert window.json()["total"] >= 5
    assert len(window.json()["items"]) == 1
    too_large = client.get("/api/v1/administration/users", params={"page_size": 101})
    assert too_large.status_code == 422

    roles = client.get("/api/v1/administration/roles").json()
    by_role = {item["name"]: item for item in roles["items"]}
    assert set(by_role) == {
        "Administrator",
        "CISO",
        "GRC Analyst",
        "SOC Analyst",
        "Security Engineer",
        "Auditor",
        "Read Only",
    }
    assert by_role["Security Engineer"]["id"] == "Security Engineer"
    assert "detection.manage" in by_role["Security Engineer"]["permissions"]
    assert "integration.manage" in by_role["Security Engineer"]["permissions"]
    assert "integration.manage" in by_role["Administrator"]["permissions"]
    assert "user.role.manage" in by_role["Administrator"]["permissions"]
    assert "asset.read" in by_role["Administrator"]["permissions"]
    assert "evidence.download" in by_role["Auditor"]["permissions"]
    assert "risk.read" in by_role["CISO"]["permissions"]
    assert "asset.read" in by_role["Read Only"]["permissions"]
    assert_safe(roles)

    audit_items: list[dict] = []
    page_num = 1
    while True:
        audits = client.get(
            "/api/v1/administration/audit-events",
            params={"page": page_num, "page_size": 100},
        ).json()
        audit_items.extend(audits["items"])
        if len(audit_items) >= audits["total"] or not audits["items"]:
            break
        page_num += 1
    by_audit = {item["id"]: item for item in audit_items}
    assert {"AUD-0001", "AUD-0002"} <= set(by_audit)
    assert by_audit["AUD-0002"]["actor"]["id"] == "USR-0001"
    assert by_audit["AUD-0002"]["action"] == "Recorded Security Engineer catalog role"
    assert by_audit["AUD-0002"]["object_type"] == "role"
    assert by_audit["AUD-0002"]["object_id"] == "Security Engineer"
    assert by_audit["AUD-0002"]["result"] == "simulated"
    assert_safe(audits)

    reviews = client.get("/api/v1/administration/access-reviews").json()
    assert reviews["total"] == 1
    review = reviews["items"][0]
    assert review["id"] == "ARV-0001"
    assert review["status"] == "in_progress"
    assert review["owner"] is None
    assert review["open_finding_count"] == 1
    assert review["total_finding_count"] == 1
    assert review["due_at"] is None
    assert_safe(reviews)


def test_reports_summary_and_definitions_omit_generated_files(client: TestClient) -> None:
    summary = client.get("/api/v1/reports/summary").json()
    assert summary["report_definition_count"] == 5
    assert summary["scheduled_report_count"] == 3
    assert summary["completed_report_count"] == 0
    assert summary["failed_report_count"] == 0
    assert summary["recent_execution_count"] == 0
    assert summary["dataset_count"] == 9
    assert summary["dataset_quality_review_count"] == 2
    assert summary["experiment_count"] == 4
    assert "no report execution" in summary["semantics"].lower()
    assert_safe(summary)

    listed = client.get(
        "/api/v1/reports/definitions",
        params={"status": "ready", "report_type": "executive_security_summary"},
    ).json()
    assert listed["page_size"] == 25
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == "RPT-0001"
    assert listed["items"][0]["schedule_state"] == "schedule_defined"
    assert listed["items"][0]["last_run_at"] is None
    assert listed["items"][0]["next_run_at"] is None
    assert_safe(listed)

    detail = client.get("/api/v1/reports/definitions/RPT-0001").json()
    assert detail["name"] == "Executive Security Summary"
    assert detail["generated_files"] == []
    assert detail["owner"]["id"] == "USR-0001"
    assert_safe(detail)
    missing = client.get("/api/v1/reports/definitions/RPT-9999")
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"
    too_large = client.get("/api/v1/reports/definitions", params={"page_size": 101})
    assert too_large.status_code == 422


def test_dataset_registry_and_experiments_are_metadata_only(client: TestClient) -> None:
    listed = client.get("/api/v1/datasets").json()
    assert listed["total"] == 9
    by_id = {item["id"]: item for item in listed["items"]}
    assert set(by_id) == {f"DS-000{index}" for index in range(1, 10)}
    assert by_id["DS-0001"]["name"] == "Smishing Dataset – IMC25"
    assert by_id["DS-0001"]["license_label"] == "CC BY 4.0"
    assert by_id["DS-0001"]["status"] == "not_downloaded"
    assert by_id["DS-0001"]["file_count"] == 0
    assert by_id["DS-0001"]["row_count"] is None
    assert by_id["DS-0006"]["verification_status"] == "verification_required"
    assert by_id["DS-0008"]["verification_status"] == "verification_required"
    assert by_id["DS-0009"]["name"] == "AegisBridge internal telemetry"
    assert_safe(listed)

    filtered = client.get(
        "/api/v1/datasets",
        params={
            "search": "Smishing",
            "status": "not_downloaded",
            "verification_status": "reviewed",
            "publication_year": 2025,
        },
    ).json()
    assert filtered["total"] == 1
    assert filtered["items"][0]["id"] == "DS-0001"
    quality = client.get(
        "/api/v1/datasets",
        params={"verification_status": "verification_required"},
    ).json()
    assert quality["total"] == 2
    assert {item["id"] for item in quality["items"]} == {"DS-0006", "DS-0008"}

    detail = client.get("/api/v1/datasets/DS-0001").json()
    assert detail["versions"][0]["version_label"] == "registry"
    assert detail["files"] == []
    assert detail["source_url"] is None
    assert any(item["id"] == "RSCH-0001" for item in detail["experiments"])
    assert "not downloaded" in (detail["notes"] or "").lower()
    assert_safe(detail)
    missing = client.get("/api/v1/datasets/DS-9999")
    assert missing.status_code == 404

    experiments = client.get(
        "/api/v1/dataset-experiments",
        params={"dataset_id": "DS-0001", "status": "completed"},
    ).json()
    assert experiments["total"] == 1
    assert experiments["items"][0]["id"] == "RSCH-0001"
    assert experiments["items"][0]["dataset"]["id"] == "DS-0001"
    assert experiments["items"][0]["metrics_summary"]
    assert_safe(experiments)

    planned = client.get(
        "/api/v1/dataset-experiments",
        params={"experiment_type": "static_feature_review", "status": "planned"},
    ).json()
    assert planned["total"] == 1
    assert planned["items"][0]["id"] == "RSCH-0004"
    assert planned["items"][0]["metrics_summary"] is None

    experiment = client.get("/api/v1/dataset-experiments/RSCH-0001").json()
    assert experiment["dataset_version_label"] == "registry"
    assert experiment["approach"] == "Manual category tabulation"
    assert "No model runtime" in experiment["metrics_summary"]
    assert_safe(experiment)
    missing_experiment = client.get("/api/v1/dataset-experiments/RSCH-9999")
    assert missing_experiment.status_code == 404


def test_cyber_range_catalog_keeps_lab_private_and_disconnected(client: TestClient) -> None:
    summary = client.get("/api/v1/cyber-range/summary").json()
    assert summary["zone_count"] == 5
    assert summary["expected_system_count"] == 5
    assert summary["active_observed_system_count"] == 0
    assert summary["telemetry_active_count"] == 0
    assert summary["telemetry_expected_count"] == 4
    assert summary["scenarios_ready_count"] == 4
    assert summary["scenarios_total_count"] == 6
    assert summary["scenarios_running_count"] == 0
    assert summary["detection_coverage_count"] == 12
    assert summary["lab_bridge_status"] == "not_connected"
    assert summary["lab_bridge_freshness"] == "not_connected"
    assert summary["last_successful_lab_sync_at"] is None
    assert summary["freshness_state"] == "not_connected"
    assert summary["data_origin"] == "DEVELOPMENT / SEEDED"
    semantics = summary["semantics"].lower()
    assert "outbound-only" in semantics
    assert "lenovo" in semantics
    assert "no remote-control" in semantics or "no remote control" in semantics
    assert "macbook" in semantics
    assert_safe(summary)

    zones = client.get("/api/v1/cyber-range/zones").json()
    assert zones["total"] == 5
    assert {item["id"] for item in zones["items"]} == {
        "MGMT",
        "CORP",
        "SERVER",
        "DMZ",
        "ATTACK",
    }
    assert {item["cidr"] for item in zones["items"]} == {
        "10.10.10.0/24",
        "10.10.20.0/24",
        "10.10.30.0/24",
        "10.10.40.0/24",
        "10.10.50.0/24",
    }
    assert all(item["observed_state"] == "not_observed" for item in zones["items"])
    assert_safe(zones)

    systems = client.get("/api/v1/cyber-range/systems").json()
    assert systems["total"] == 5
    by_id = {item["id"]: item for item in systems["items"]}
    assert set(by_id) == {
        "LAB-GW-01",
        "SEC-WAZUH-01",
        "WIN-USER-01",
        "LINUX-APP-01",
        "KALI-RED-01",
    }
    assert by_id["LAB-GW-01"]["zone"]["id"] == "MGMT"
    assert by_id["LAB-GW-01"]["observed_state"] == "not_observed"
    assert by_id["LAB-GW-01"]["telemetry_status"] == "not_connected"
    assert by_id["LAB-GW-01"]["last_seen_at"] is None
    assert by_id["KALI-RED-01"]["telemetry_status"] == "not_reporting"
    assert_safe(systems)

    filtered = client.get(
        "/api/v1/cyber-range/systems",
        params={"zone": "MGMT", "telemetry_status": "not_connected"},
    ).json()
    assert filtered["total"] == 2
    assert {item["id"] for item in filtered["items"]} == {"LAB-GW-01", "SEC-WAZUH-01"}

    detail = client.get("/api/v1/cyber-range/systems/LAB-GW-01").json()
    assert detail["hostname"] == "LAB-GW-01"
    assert detail["telemetry_status"] == "not_connected"
    assert "not_connected" in (detail["telemetry_semantics"] or "").lower()
    assert_safe(detail)
    missing = client.get("/api/v1/cyber-range/systems/LAB-MISSING")
    assert missing.status_code == 404

    relationships = client.get("/api/v1/cyber-range/system-relationships").json()
    assert relationships["total"] == 3
    stored = {
        (item["source_system_id"], item["target_system_id"], item["relationship_kind"])
        for item in relationships["items"]
    }
    assert stored == {
        ("SEC-WAZUH-01", "WIN-USER-01", "monitors"),
        ("SEC-WAZUH-01", "LINUX-APP-01", "monitors"),
        ("WIN-USER-01", "SEC-WAZUH-01", "depends_on"),
    }
    assert ("WIN-USER-01", "SEC-WAZUH-01", "monitors") not in stored
    assert all(
        item["source_system_id"] != item["target_system_id"] for item in relationships["items"]
    )
    assert_safe(relationships)

    scenarios = client.get("/api/v1/cyber-range/scenarios").json()
    assert scenarios["total"] == 6
    ready = client.get("/api/v1/cyber-range/scenarios", params={"status": "ready"}).json()
    assert ready["total"] == 3
    technique = client.get(
        "/api/v1/cyber-range/scenarios",
        params={"attack_technique": "T1059.001"},
    ).json()
    assert technique["total"] == 1
    assert technique["items"][0]["id"] == "SCN-0003"
    scenario = client.get("/api/v1/cyber-range/scenarios/SCN-0001").json()
    assert scenario["last_run_at"] is None
    assert "DET-0001" in scenario["expected_detection_ids"]
    assert "WIN-USER-01" in scenario["expected_system_ids"]
    assert any(item["id"] == "T1110" for item in scenario["attack_techniques"])
    assert "no execute" in (scenario["safety_notes"] or "").lower()
    assert_safe(scenario)
    missing_scenario = client.get("/api/v1/cyber-range/scenarios/SCN-9999")
    assert missing_scenario.status_code == 404

    telemetry = client.get("/api/v1/cyber-range/telemetry").json()
    assert telemetry["total"] == 5
    assert all(item["status"] in {"not_connected", "not_reporting"} for item in telemetry["items"])
    assert all(item["last_seen_at"] is None for item in telemetry["items"])
    assert_safe(telemetry)

    detections = client.get("/api/v1/cyber-range/detections").json()
    assert detections["total"] == 12
    assert {item["id"] for item in detections["items"]} == {
        f"DET-{index:04d}" for index in range(1, 13)
    }
    assert all(item["validation_state"] == "not_validated" for item in detections["items"])
    assert all(item["last_validated_at"] is None for item in detections["items"])
    assert all(item["wazuh_mapping_status"] == "not_connected" for item in detections["items"])
    filtered_detections = client.get(
        "/api/v1/cyber-range/detections",
        params={"data_source": "Sysmon", "validation_state": "not_validated"},
    ).json()
    assert filtered_detections["total"] == 3
    assert_safe(detections)

    openapi = client.get("/openapi.json").json()
    cyber_paths = [path for path in openapi["paths"] if path.startswith("/api/v1/cyber-range")]
    assert set(cyber_paths) == {
        "/api/v1/cyber-range/summary",
        "/api/v1/cyber-range/zones",
        "/api/v1/cyber-range/systems",
        "/api/v1/cyber-range/systems/{system_id}",
        "/api/v1/cyber-range/system-relationships",
        "/api/v1/cyber-range/system-relationships/{relationship_id}",
        "/api/v1/cyber-range/scenarios",
        "/api/v1/cyber-range/scenarios/{scenario_id}",
        "/api/v1/cyber-range/telemetry",
        "/api/v1/cyber-range/detections",
    }
    relationship_methods = {
        "/api/v1/cyber-range/system-relationships": {"get", "post"},
        "/api/v1/cyber-range/system-relationships/{relationship_id}": {"patch", "delete"},
    }
    for path in cyber_paths:
        methods = {
            key
            for key in openapi["paths"][path]
            if key in {"get", "post", "put", "patch", "delete"}
        }
        assert methods == relationship_methods.get(path, {"get"})
        assert "put" not in methods

    too_large = client.get("/api/v1/cyber-range/systems", params={"page_size": 101})
    assert too_large.status_code == 422


def test_openapi_lists_read_routes(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert spec["openapi"].startswith("3.")
    for path in READ_PATHS:
        assert "get" in spec["paths"][path]
    schemas = spec["components"]["schemas"]
    assert "ErrorBody" in schemas
    overview = schemas["OverviewResponse"]["properties"]
    assert "security_score" not in overview
    vulnerability = schemas["VulnerabilityDetail"]["properties"]
    assert "score" not in vulnerability
    assert "cvss_base_score" in vulnerability
    assert "epss" in vulnerability
    assert "intelligence" in vulnerability
    assert "intelligence" not in schemas["VulnerabilityListItem"]["properties"]
    intelligence = schemas["VulnerabilityIntelligenceRead"]["properties"]
    assert set(intelligence) == {"nvd", "kev", "epss"}
    assert "api_key" not in str(schemas["VulnerabilityIntelligenceRead"])
    assert "http://" not in str(schemas["VulnerabilityNvdRead"])


def assert_safe(payload: object) -> None:
    encoded = str(payload)
    assert UUID_RE.search(encoded) is None
    keys = set(_keys(payload))
    assert keys.isdisjoint(FORBIDDEN_KEYS)


def _keys(value: object):
    if isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _keys(item)
    elif isinstance(value, list):
        for item in value:
            yield from _keys(item)
