"""Download the pinned ATT&CK STIX bundle. The URL comes from server settings."""

from __future__ import annotations

import time

import httpx

from app.core.config import Settings
from app.integrations.attack.errors import AttackIngestError

USER_AGENT = "AegisBridge/attack-catalog"
RETRY_STATUS = frozenset({429, 500, 502, 503, 504})
MAX_ATTEMPTS = 3


def fetch_attack_bundle(settings: Settings) -> bytes:
    """GET the configured Enterprise bundle. Callers cannot choose the URL."""
    timeout = settings.attack_stix_timeout_seconds
    last_reason = "network"
    with httpx.Client(
        timeout=timeout,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        follow_redirects=True,
    ) as client:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                response = client.get(settings.attack_enterprise_stix_url)
            except httpx.TimeoutException:
                last_reason = "timeout"
            except httpx.HTTPError:
                last_reason = "network"
            else:
                if response.status_code in RETRY_STATUS and attempt < MAX_ATTEMPTS:
                    time.sleep(0.4 * attempt)
                    continue
                return _body(response, settings.attack_stix_max_bytes)
            if attempt < MAX_ATTEMPTS:
                time.sleep(0.4 * attempt)
    raise AttackIngestError(last_reason)


def _body(response: httpx.Response, max_bytes: int) -> bytes:
    content_type = response.headers.get("content-type", "")
    if content_type.lower().startswith("text/html"):
        raise AttackIngestError("malformed_bundle")
    if response.status_code != 200:
        raise AttackIngestError("unavailable")
    if len(response.content) > max_bytes:
        raise AttackIngestError("response_too_large")
    return response.content
