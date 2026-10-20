"""Read-only API contracts against the development seed."""

import re

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app

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
    "/api/v1/governance/summary",
]


@pytest.fixture
def client():
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    application = create_app()
    with TestClient(application) as test_client:
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
    assert detail["tasks"] == []
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
    assert body["control_implementations"]["by_status"] == {"partial": 1}
    assert body["control_implementations"]["tests_passed"] == 0
    assert body["evidence_freshness"]["with_sha256"] == 1
    assert body["assessment_work"]["tests_recorded"] == 0
    assert body["policies"][0]["id"] == "POL-0001"
    assert body["policies"][0]["status"] == "draft"
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
