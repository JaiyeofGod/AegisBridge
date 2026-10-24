"""Bounded client for the official abuse.ch ThreatFox and URLhaus endpoints."""

from __future__ import annotations

import json
import time
from typing import Protocol, cast

import httpx

from app.core.config import Settings
from app.integrations.threat_intel.errors import ThreatFeedError

USER_AGENT = "AegisBridge/threat-intelligence"
ALLOWED_URLS = frozenset(
    {
        "https://threatfox-api.abuse.ch/api/v1/",
        "https://urlhaus-api.abuse.ch/v1/urls/recent/",
    }
)
RETRY_STATUS = frozenset({429, 500, 502, 503, 504})
MAX_ATTEMPTS = 3


class FeedClient(Protocol):
    def request(
        self,
        method: str,
        url: str,
        *,
        json_body: dict[str, object] | None = None,
    ) -> dict[str, object]: ...

    def close(self) -> None: ...


class HttpxFeedClient:
    """Sync client. Callers keep the database session closed while this runs."""

    def __init__(
        self,
        settings: Settings,
        client: httpx.Client | None = None,
        *,
        attempts: int = MAX_ATTEMPTS,
        backoff_seconds: float = 0.4,
    ) -> None:
        self._settings = settings
        self._owns_client = client is None
        self._client = client or httpx.Client(
            timeout=settings.threat_intel_http_timeout_seconds,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            follow_redirects=False,
        )
        self._attempts = attempts
        self._backoff_seconds = backoff_seconds

    def request(
        self,
        method: str,
        url: str,
        *,
        json_body: dict[str, object] | None = None,
    ) -> dict[str, object]:
        key = (self._settings.abusech_auth_key or "").strip()
        if not key:
            raise ThreatFeedError("auth_unconfigured")
        if url not in ALLOWED_URLS:
            raise ThreatFeedError("endpoint_rejected")
        headers = {"Auth-Key": key}
        last_error = ThreatFeedError("network")
        for attempt in range(1, self._attempts + 1):
            try:
                body = self._once(method, url, headers=headers, json_body=json_body)
            except ThreatFeedError as exc:
                retryable = exc.reason in {"timeout", "network", "http_status"}
                if not retryable or attempt == self._attempts:
                    raise
                last_error = exc
            else:
                return body
            if attempt < self._attempts and self._backoff_seconds > 0:
                time.sleep(self._backoff_seconds * attempt)
        raise last_error

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def _once(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        json_body: dict[str, object] | None,
    ) -> dict[str, object]:
        try:
            with self._client.stream(
                method,
                url,
                headers=headers,
                json=json_body,
            ) as response:
                return self._read(response)
        except ThreatFeedError:
            raise
        except httpx.TimeoutException as exc:
            raise ThreatFeedError("timeout") from exc
        except httpx.TransportError as exc:
            raise ThreatFeedError("network") from exc

    def _read(self, response: httpx.Response) -> dict[str, object]:
        if response.status_code in RETRY_STATUS:
            response.read()
            raise ThreatFeedError("http_status")
        if response.status_code in {401, 403}:
            response.read()
            raise ThreatFeedError("unauthorized")
        if response.status_code != 200:
            response.read()
            raise ThreatFeedError("rejected")
        content_type = response.headers.get("content-type", "").lower()
        if "html" in content_type:
            response.read()
            raise ThreatFeedError("content_type")
        raw = bytearray()
        limit = self._settings.threat_intel_max_bytes
        for chunk in response.iter_bytes():
            if len(raw) + len(chunk) > limit:
                raise ThreatFeedError("response_too_large")
            raw.extend(chunk)
        try:
            parsed = json.loads(bytes(raw))
        except json.JSONDecodeError as exc:
            raise ThreatFeedError("invalid_json") from exc
        if not isinstance(parsed, dict):
            raise ThreatFeedError("unexpected_payload")
        return cast(dict[str, object], parsed)
