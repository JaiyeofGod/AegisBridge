"""Risk ↔ control relationship link/unlink and read contracts."""

from __future__ import annotations

import os
import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from tests.csrf_helpers import csrf_headers
from tests.test_authorization import login_as_role

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.audit import AuditEvent
from app.models.evidence import Evidence, EvidenceControlLink
from app.models.grc import Control, ControlImplementation, ControlTest
from app.models.risk import Risk, RiskAssessment, RiskControlMapping, RiskTreatment

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
PATH = "/api/v1/risks/RISK-0021/controls/CTRL-0002"
UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
        session.execute(delete(RiskControlMapping))
        session.commit()
    application = create_app()
    with TestClient(application) as test_client:
        yield test_client
    get_settings.cache_clear()
    os.environ.pop("AEGIS_DEV_ADMIN_PASSWORD", None)


def _score_snapshot() -> dict:
    with SessionLocal() as session:
        risk = session.scalar(select(Risk).where(Risk.human_id == "RISK-0021"))
        assert risk is not None
        assessment = session.scalar(
            select(RiskAssessment).where(
                RiskAssessment.risk_id == risk.id,
                RiskAssessment.is_current.is_(True),
            )
        )
        treatment = session.scalar(select(RiskTreatment).where(RiskTreatment.risk_id == risk.id))
        control = session.scalar(select(Control).where(Control.human_id == "CTRL-0002"))
        assert control is not None
        implementation = session.scalar(
            select(ControlImplementation).where(ControlImplementation.control_id == control.id)
        )
        return {
            "likelihood": None if assessment is None else assessment.likelihood,
            "impact": None if assessment is None else assessment.impact,
            "score": None if assessment is None else assessment.score,
            "treatment_status": None if treatment is None else treatment.status,
            "implementation_status": None if implementation is None else implementation.status,
            "test_count": session.scalar(
                select(func.count())
                .select_from(ControlTest)
                .where(ControlTest.control_id == control.id)
            ),
            "evidence_count": session.scalar(
                select(func.count())
                .select_from(EvidenceControlLink)
                .where(EvidenceControlLink.control_id == control.id)
            ),
            "risk_exists": True,
            "control_exists": True,
            "evidence_exists": session.scalar(
                select(Evidence).where(Evidence.human_id == "EVID-0041")
            )
            is not None,
        }


def test_link_requires_auth_manage_and_csrf(client: TestClient) -> None:
    assert client.post(PATH).status_code == 401

    login_as_role(client, "Auditor")
    denied = client.post(PATH, headers=csrf_headers(client))
    assert denied.status_code == 403

    login_as_role(client, "GRC Analyst")
    missing_csrf = client.post(PATH)
    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["code"] == "csrf_failed"

    bad_csrf = client.post(PATH, headers={"X-CSRF-Token": "not-the-token"})
    assert bad_csrf.status_code == 403


def test_link_rejects_body_and_unknown_ids(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    body = client.post(
        PATH, headers=csrf_headers(client), json={"score": 1, "permissions": ["risk.manage"]}
    )
    assert body.status_code == 422

    missing_risk = client.post(
        "/api/v1/risks/RISK-9999/controls/CTRL-0002",
        headers=csrf_headers(client),
    )
    assert missing_risk.status_code == 404
    missing_control = client.post(
        "/api/v1/risks/RISK-0021/controls/CTRL-9999",
        headers=csrf_headers(client),
    )
    assert missing_control.status_code == 404


def test_link_unlink_is_relationship_only(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    before = _score_snapshot()
    before_detail = client.get("/api/v1/risks/RISK-0021").json()

    linked = client.post(PATH, headers=csrf_headers(client))
    assert linked.status_code == 200, linked.text
    assert linked.json() == {"linked": True, "risk_id": "RISK-0021", "control_id": "CTRL-0002"}
    assert UUID_RE.search(linked.text) is None

    again = client.post(PATH, headers=csrf_headers(client))
    assert again.status_code == 200
    assert again.json()["linked"] is True

    risk = client.get("/api/v1/risks/RISK-0021").json()
    assert risk["likelihood"] == before_detail["likelihood"]
    assert risk["impact"] == before_detail["impact"]
    assert risk["score"] == before_detail["score"]
    assert risk["treatment_status"] == before_detail["treatment_status"]
    assert len(risk["control_mappings"]) == 1
    mapped = risk["control_mappings"][0]
    assert mapped["id"] == "CTRL-0002"
    assert mapped["control_code"] == "AC-2"
    assert mapped["framework_code"] == "NIST-800-53"
    assert mapped["licensed_text_included"] is False
    assert "safeguard" not in client.get("/api/v1/risks/RISK-0021").text.lower()
    assert UUID_RE.search(client.get("/api/v1/risks/RISK-0021").text) is None
    assert "does not change likelihood" in risk["control_mapping_semantics"]

    control = client.get("/api/v1/governance/controls/CTRL-0002").json()
    assert control["risks"][0]["id"] == "RISK-0021"
    assert control["risks"][0]["score"] == before["score"]
    assert "residual_score" not in control["risks"][0]
    assert "effectiveness" not in control["risks"][0]
    assert UUID_RE.search(str(control["risks"])) is None

    after_link = _score_snapshot()
    assert after_link == before

    with SessionLocal() as session:
        events = session.scalars(
            select(AuditEvent).where(AuditEvent.action == "RISK_CONTROL_LINK")
        ).all()
        assert any(event.object_id == "RISK-0021:CTRL-0002" for event in events)

    removed = client.delete(PATH, headers=csrf_headers(client))
    assert removed.status_code == 200
    assert removed.json()["linked"] is False
    missing = client.delete(PATH, headers=csrf_headers(client))
    assert missing.status_code == 404

    after = client.get("/api/v1/risks/RISK-0021").json()
    assert after["control_mappings"] == []
    assert after["likelihood"] == before["likelihood"]
    assert after["treatment_status"] == before["treatment_status"]
    control_after = client.get("/api/v1/governance/controls/CTRL-0002").json()
    assert control_after["risks"] == []
    assert _score_snapshot() == before

    with SessionLocal() as session:
        events = session.scalars(
            select(AuditEvent).where(AuditEvent.action == "RISK_CONTROL_UNLINK")
        ).all()
        assert any(event.object_id == "RISK-0021:CTRL-0002" for event in events)


def test_openapi_documents_risk_control_mapping(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    spec = client.get("/openapi.json").json()
    path = "/api/v1/risks/{risk_id}/controls/{control_id}"
    assert path in spec["paths"]
    assert {"SessionCookie": []} in spec["paths"][path]["post"]["security"]
    assert {"SessionCookie": []} in spec["paths"][path]["delete"]["security"]
    assert "CSRF" in spec["paths"][path]["post"]["description"]
    assert "RiskControlLinkResult" in spec["components"]["schemas"]
    mapped = spec["components"]["schemas"]["RiskMappedControl"]["properties"]
    assert mapped["licensed_text_included"]["default"] is False
    assert "risks" in spec["components"]["schemas"]["ControlDetail"]["properties"]
