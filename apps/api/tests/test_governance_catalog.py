"""Governance control catalog pagination, search, filters, and sort."""

from __future__ import annotations

import os
import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from tests.test_authorization import login_as_role

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.main import create_app
from app.models.grc import Control, ControlImplementation, Framework, FrameworkVersion
from app.models.organization import Organization
from app.security.permissions import ROLE_PERMISSIONS

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    _cleanup_extra_controls()
    with SessionLocal() as session:
        seed_development(session)
    application = create_app()
    with TestClient(application) as test_client:
        yield test_client
    _cleanup_extra_controls()
    get_settings.cache_clear()
    os.environ.pop("AEGIS_DEV_ADMIN_PASSWORD", None)


_EXTRA_CONTROL_IDS = (
    "CTRL-0010",
    "CTRL-0011",
    "CTRL-0012",
    "CTRL-0013",
    "CTRL-0014",
    "CTRL-0090",
    "CTRL-0091",
)


def _seed_extra_controls() -> None:
    """Add catalog rows so pagination/search/filter assertions are meaningful."""
    with SessionLocal() as session:
        org = session.scalar(select(Organization).order_by(Organization.name))
        assert org is not None
        nist = session.scalar(select(Framework).where(Framework.code == "NIST-800-53"))
        assert nist is not None
        nist_rev = session.scalar(
            select(FrameworkVersion).where(FrameworkVersion.framework_id == nist.id)
        )
        assert nist_rev is not None

        extras = [
            ("CTRL-0010", "AC-3", "Access enforcement", "AC", "implemented"),
            ("CTRL-0011", "AC-6", "Least privilege", "AC", "planned"),
            ("CTRL-0012", "AU-2", "Audit events", "AU", "partial"),
            ("CTRL-0013", "CM-2", "Baseline configuration", "CM", "implemented"),
            ("CTRL-0014", "SC-7", "Boundary protection", "SC", "not_implemented"),
        ]
        for human_id, code, title, family, status in extras:
            existing = session.scalar(select(Control).where(Control.human_id == human_id))
            if existing is not None:
                continue
            control = Control(
                organization_id=org.id,
                framework_version_id=nist_rev.id,
                human_id=human_id,
                control_code=code,
                title=title,
                family=family,
            )
            session.add(control)
            session.flush()
            session.add(
                ControlImplementation(
                    control_id=control.id,
                    status=status,
                    notes="Catalog pagination test fixture.",
                )
            )
        session.commit()


def _cleanup_extra_controls() -> None:
    """Remove fixture rows so shared DB seed counts stay stable for later suites."""
    with SessionLocal() as session:
        controls = session.scalars(
            select(Control).where(Control.human_id.in_(_EXTRA_CONTROL_IDS))
        ).all()
        control_ids = [row.id for row in controls]
        if control_ids:
            session.execute(
                delete(ControlImplementation).where(
                    ControlImplementation.control_id.in_(control_ids)
                )
            )
            session.execute(delete(Control).where(Control.id.in_(control_ids)))
        # Prior test runs may have left an ISO fixture framework.
        iso = session.scalar(select(Framework).where(Framework.code == "ISO-27001"))
        if iso is not None:
            rev_ids = list(
                session.scalars(
                    select(FrameworkVersion.id).where(FrameworkVersion.framework_id == iso.id)
                ).all()
            )
            if rev_ids:
                iso_controls = session.scalars(
                    select(Control).where(Control.framework_version_id.in_(rev_ids))
                ).all()
                iso_ids = [row.id for row in iso_controls]
                if iso_ids:
                    session.execute(
                        delete(ControlImplementation).where(
                            ControlImplementation.control_id.in_(iso_ids)
                        )
                    )
                    session.execute(delete(Control).where(Control.id.in_(iso_ids)))
                session.execute(delete(FrameworkVersion).where(FrameworkVersion.id.in_(rev_ids)))
            session.execute(delete(Framework).where(Framework.id == iso.id))
        session.commit()


def test_control_list_requires_auth_and_permission(client: TestClient) -> None:
    assert client.get("/api/v1/governance/controls").status_code == 401

    login_as_role(client, "SOC Analyst")
    denied = client.get("/api/v1/governance/controls")
    assert denied.status_code == 403
    assert denied.json()["code"] == "forbidden"

    login_as_role(client, "GRC Analyst")
    assert client.get("/api/v1/governance/controls").status_code == 200


def test_control_pagination_and_bounds(client: TestClient) -> None:
    _seed_extra_controls()
    login_as_role(client, "GRC Analyst")

    page1 = client.get(
        "/api/v1/governance/controls",
        params={"page": 1, "page_size": 2, "sort": "id", "direction": "asc"},
    )
    assert page1.status_code == 200
    body1 = page1.json()
    assert body1["page"] == 1
    assert body1["page_size"] == 2
    assert body1["total"] >= 6
    assert len(body1["items"]) == 2
    ids1 = [item["id"] for item in body1["items"]]

    page2 = client.get(
        "/api/v1/governance/controls",
        params={"page": 2, "page_size": 2, "sort": "id", "direction": "asc"},
    ).json()
    ids2 = [item["id"] for item in page2["items"]]
    assert page2["total"] == body1["total"]
    assert set(ids1).isdisjoint(ids2)

    beyond = client.get(
        "/api/v1/governance/controls",
        params={"page": 999, "page_size": 25},
    ).json()
    assert beyond["items"] == []
    assert beyond["total"] == body1["total"]

    too_large = client.get("/api/v1/governance/controls", params={"page_size": 101})
    assert too_large.status_code == 422
    negative = client.get("/api/v1/governance/controls", params={"page": 0})
    assert negative.status_code == 422
    negative_size = client.get("/api/v1/governance/controls", params={"page_size": -1})
    assert negative_size.status_code == 422


def test_control_search_metadata_only(client: TestClient) -> None:
    _seed_extra_controls()
    login_as_role(client, "GRC Analyst")

    by_id = client.get("/api/v1/governance/controls", params={"q": "CTRL-0010"}).json()
    assert by_id["total"] == 1
    assert by_id["items"][0]["id"] == "CTRL-0010"

    by_code = client.get("/api/v1/governance/controls", params={"q": "ac-6"}).json()
    assert by_code["total"] == 1
    assert by_code["items"][0]["control_code"] == "AC-6"

    by_title = client.get("/api/v1/governance/controls", params={"q": "least"}).json()
    assert by_title["total"] == 1
    assert "Least" in by_title["items"][0]["title"]

    by_framework = client.get("/api/v1/governance/controls", params={"q": "nist"}).json()
    assert by_framework["total"] >= 1
    assert all(item["framework_code"] == "NIST-800-53" for item in by_framework["items"])

    empty = client.get("/api/v1/governance/controls", params={"q": "zzznomatch"}).json()
    assert empty["total"] == 0
    assert empty["items"] == []

    listed = client.get("/api/v1/governance/controls", params={"page_size": 100})
    blob = listed.text.lower()
    assert "safeguard" not in blob
    assert UUID_RE.search(blob) is None
    for item in listed.json()["items"]:
        assert "licensed_text" not in item
        assert set(item.keys()) >= {
            "id",
            "control_code",
            "title",
            "framework_code",
            "implementation_status",
        }

    detail = client.get("/api/v1/governance/controls/CTRL-0002").json()
    assert detail["licensed_text_included"] is False


def test_control_filters_and_combined_search(client: TestClient) -> None:
    _seed_extra_controls()
    login_as_role(client, "GRC Analyst")

    nist = client.get(
        "/api/v1/governance/controls",
        params={"framework": "NIST-800-53"},
    ).json()
    assert nist["total"] >= 5
    assert all(item["framework_code"] == "NIST-800-53" for item in nist["items"])

    implemented = client.get(
        "/api/v1/governance/controls",
        params={"implementation_status": "implemented"},
    ).json()
    assert implemented["total"] >= 2
    assert all(item["implementation_status"] == "implemented" for item in implemented["items"])

    combined = client.get(
        "/api/v1/governance/controls",
        params={
            "framework": "NIST-800-53",
            "implementation_status": "planned",
            "q": "privilege",
        },
    ).json()
    assert combined["total"] == 1
    assert combined["items"][0]["id"] == "CTRL-0011"

    bad_status = client.get(
        "/api/v1/governance/controls",
        params={"implementation_status": "invented"},
    )
    assert bad_status.status_code == 422


def test_control_sort_allowlist(client: TestClient) -> None:
    _seed_extra_controls()
    login_as_role(client, "GRC Analyst")

    asc = client.get(
        "/api/v1/governance/controls",
        params={"sort": "title", "direction": "asc", "page_size": 100},
    ).json()
    titles = [item["title"] for item in asc["items"]]
    assert len(titles) >= 2

    desc = client.get(
        "/api/v1/governance/controls",
        params={"sort": "title", "direction": "desc", "page_size": 100},
    ).json()
    # DB collation may differ from Python sorted(); require asc/desc to invert.
    assert [item["title"] for item in desc["items"]] == list(reversed(titles))

    # Stable tie-break: identical titles keep human_id order.
    with SessionLocal() as session:
        org = session.scalar(select(Organization).order_by(Organization.name))
        nist = session.scalar(select(Framework).where(Framework.code == "NIST-800-53"))
        assert org is not None and nist is not None
        rev = session.scalar(
            select(FrameworkVersion).where(FrameworkVersion.framework_id == nist.id)
        )
        assert rev is not None
        for human_id in ("CTRL-0090", "CTRL-0091"):
            if session.scalar(select(Control).where(Control.human_id == human_id)):
                continue
            control = Control(
                organization_id=org.id,
                framework_version_id=rev.id,
                human_id=human_id,
                control_code=f"ZZ-{human_id[-2:]}",
                title="Same Title Tie",
                family="ZZ",
            )
            session.add(control)
            session.flush()
            session.add(ControlImplementation(control_id=control.id, status="planned"))
        session.commit()

    tied = client.get(
        "/api/v1/governance/controls",
        params={"q": "Same Title Tie", "sort": "title", "direction": "asc"},
    ).json()
    assert [item["id"] for item in tied["items"]] == ["CTRL-0090", "CTRL-0091"]

    rejected = client.get(
        "/api/v1/governance/controls",
        params={"sort": "organization_id"},
    )
    assert rejected.status_code == 422
    bad_dir = client.get(
        "/api/v1/governance/controls",
        params={"sort": "title", "direction": "sideways"},
    )
    assert bad_dir.status_code == 422


def test_control_list_openapi_documents_query_params(client: TestClient) -> None:
    login_as_role(client, "GRC Analyst")
    spec = client.get("/openapi.json").json()
    params = {
        item["name"]: item
        for item in spec["paths"]["/api/v1/governance/controls"]["get"]["parameters"]
    }
    expected = (
        "page",
        "page_size",
        "q",
        "framework",
        "implementation_status",
        "sort",
        "direction",
    )
    for name in expected:
        assert name in params
    assert params["page_size"]["schema"]["maximum"] == 100
    security = spec["paths"]["/api/v1/governance/controls"]["get"].get("security")
    assert {"SessionCookie": []} in (security or [])


def test_control_list_no_permission_bypass_via_query(client: TestClient) -> None:
    login_as_role(client, "Security Engineer")
    assert "control.read" not in ROLE_PERMISSIONS["Security Engineer"]
    response = client.get(
        "/api/v1/governance/controls",
        params={"q": "CTRL", "framework": "NIST-800-53"},
    )
    assert response.status_code == 403
