"""Health endpoint tests."""

from fastapi.testclient import TestClient


def test_health_live(client: TestClient) -> None:
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "service" in payload
    assert "database_url" not in payload
    assert "session_secret" not in payload
    assert "password" not in response.text.lower()


def test_health_ready(client: TestClient) -> None:
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert isinstance(payload["checks"], list)
    names = {item["name"] for item in payload["checks"]}
    assert "postgresql" in names
    postgres = next(item for item in payload["checks"] if item["name"] == "postgresql")
    assert postgres["status"] == "ok"
    assert postgres["required"] is True
    assert "database_url" not in response.text
    assert "postgresql+psycopg" not in response.text


def test_health_aggregate(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["live"] == "ok"
    assert payload["ready"] == "ready"
    assert payload["status"] == "ok"
    assert "checks" in payload
