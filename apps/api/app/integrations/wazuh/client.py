"""Authenticated Wazuh indexer search. The URL comes from server settings only."""

from __future__ import annotations

import json
import logging
import re
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.core.config import Settings
from app.integrations.wazuh.errors import WazuhError
from app.integrations.wazuh.models import RawAlertPage

logger = logging.getLogger(__name__)

_INDEX = re.compile(r"^[A-Za-z0-9_.*-]{1,80}$")
_SOURCE_FIELDS = [
    "id",
    "timestamp",
    "rule.id",
    "rule.level",
    "rule.description",
    "rule.groups",
    "rule.mitre.id",
    "rule.mitre.tactic",
    "agent.id",
    "agent.name",
    "manager.name",
    "decoder.name",
    "data.srcip",
    "data.dstip",
    "data.srcuser",
    "data.dstuser",
    "data.user",
]
_ATTEMPTS = 3
_RETRY_STATUS = {429, 500, 502, 503, 504}


class HttpxWazuhClient:
    """One bounded `_search` against the configured indexer. Redirects are off."""

    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._settings = settings
        self._sleep = sleep
        self.tls_verify = settings.wazuh_tls_verify()
        self._http = httpx.Client(
            timeout=settings.wazuh_http_timeout_seconds,
            verify=self.tls_verify,
            follow_redirects=False,
            transport=transport,
        )

    def close(self) -> None:
        self._http.close()

    def search(self, *, since: datetime, limit: int) -> RawAlertPage:
        url = search_url(self._settings)
        username = (self._settings.wazuh_username or "").strip()
        password = self._settings.wazuh_password or ""
        if not username or not password:
            raise WazuhError("not_configured")
        body = {
            "size": limit,
            "sort": [{"timestamp": "desc"}, {"id": "asc"}],
            "query": {"range": {"timestamp": {"gte": _indexer_time(since)}}},
            "_source": {"includes": _SOURCE_FIELDS},
        }
        payload = self._post(url, body, username, password)
        return _page(payload)

    def _post(
        self,
        url: str,
        body: dict[str, object],
        username: str,
        password: str,
    ) -> dict[str, Any]:
        auth = httpx.BasicAuth(username, password)
        last_reason = "http_error"
        for attempt in range(_ATTEMPTS):
            try:
                response = self._http.post(url, json=body, auth=auth)
            except httpx.TimeoutException:
                last_reason = "timeout"
            except httpx.HTTPError:
                last_reason = "network"
            else:
                if response.status_code in (401, 403):
                    raise WazuhError("auth_failed")
                if response.status_code in _RETRY_STATUS:
                    last_reason = "http_error"
                elif response.status_code != 200:
                    raise WazuhError("http_error")
                else:
                    return _json(response, self._settings.wazuh_max_bytes)
            if attempt + 1 < _ATTEMPTS:
                self._sleep(0.2 * (attempt + 1))
        logger.error("wazuh indexer request failed reason=%s", last_reason)
        raise WazuhError(last_reason)


def search_url(settings: Settings) -> str:
    raw = (settings.wazuh_indexer_url or "").strip()
    parsed = urlsplit(raw)
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        raise WazuhError("not_configured")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise WazuhError("not_configured")
    if parsed.scheme == "http" and settings.app_env.lower() == "production":
        raise WazuhError("not_configured")
    index = settings.wazuh_alert_index.strip()
    if _INDEX.fullmatch(index) is None or ".." in index:
        raise WazuhError("not_configured")
    return f"{raw.rstrip('/')}/{index}/_search"


def _indexer_time(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _json(response: httpx.Response, max_bytes: int) -> dict[str, Any]:
    raw = response.content
    if len(raw) > max_bytes:
        raise WazuhError("response_too_large")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise WazuhError("malformed_response") from exc
    if not isinstance(payload, dict):
        raise WazuhError("malformed_response")
    return payload


def _page(payload: dict[str, Any]) -> RawAlertPage:
    hits_body = payload.get("hits")
    if not isinstance(hits_body, dict):
        raise WazuhError("malformed_response")
    raw_hits = hits_body.get("hits")
    if not isinstance(raw_hits, list):
        raise WazuhError("malformed_response")
    hits = tuple(item for item in raw_hits if isinstance(item, dict))
    omitted = len(raw_hits) - len(hits)
    if omitted:
        logger.error("wazuh indexer omitted non-object hits count=%s", omitted)
    return RawAlertPage(
        hits=hits,
        total=_total(hits_body.get("total"), len(raw_hits)),
        omitted=omitted,
    )


def _total(value: object, fallback: int) -> int:
    if isinstance(value, int) and not isinstance(value, bool):
        return max(value, 0)
    if isinstance(value, dict):
        inner = value.get("value")
        if isinstance(inner, int) and not isinstance(inner, bool):
            return max(inner, 0)
    return fallback
