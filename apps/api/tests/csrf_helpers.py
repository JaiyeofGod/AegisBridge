"""Shared CSRF helpers for authenticated write tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.security.csrf import CSRF_HEADER_NAME


def fetch_csrf(client: TestClient) -> str:
    response = client.get("/api/v1/auth/csrf")
    assert response.status_code == 200, response.text
    token = response.json()["csrf_token"]
    assert isinstance(token, str) and token
    return token


def csrf_headers(client: TestClient) -> dict[str, str]:
    return {CSRF_HEADER_NAME: fetch_csrf(client)}


def logout(client: TestClient) -> None:
    response = client.post("/api/v1/auth/logout", headers=csrf_headers(client))
    assert response.status_code == 200, response.text
