"""abuse.ch ThreatFox recent-IOC adapter.

Official request: POST https://threatfox-api.abuse.ch/api/v1/
with ``{"query": "get_iocs", "days": N}``. ``days`` is 1 through 7.
The Auth-Key header is required. This module does not submit indicators.
"""

from __future__ import annotations

from app.core.config import Settings
from app.integrations.threat_intel.errors import ThreatFeedError
from app.integrations.threat_intel.http import FeedClient
from app.integrations.threat_intel.models import FeedBatch, NormalizedIoc
from app.integrations.threat_intel.normalize import (
    bounded_text,
    coarse_type,
    normalize_domain,
    normalize_hash,
    normalize_ip_port,
    normalize_url,
    parse_source_time,
    public_https_url,
    source_confidence,
    source_record_id,
    source_tags,
)

THREATFOX_URL = "https://threatfox-api.abuse.ch/api/v1/"
_HASH_TYPES = {
    "md5_hash": "md5",
    "sha1_hash": "sha1",
    "sha256_hash": "sha256",
}


def fetch_threatfox(settings: Settings, client: FeedClient) -> FeedBatch:
    """Return a bounded recent window. The caller supplies the HTTP client."""
    if settings.threatfox_api_url != THREATFOX_URL:
        raise ThreatFeedError("endpoint_rejected")
    days = min(7, max(1, settings.threatfox_days))
    body = client.request(
        "POST",
        THREATFOX_URL,
        json_body={"query": "get_iocs", "days": days},
    )
    return parse_threatfox(body, limit=_record_limit(settings))


def parse_threatfox(body: object, *, limit: int) -> FeedBatch:
    if not isinstance(body, dict):
        raise ThreatFeedError("unexpected_payload")
    status = body.get("query_status")
    if status == "no_results":
        return FeedBatch((), 0)
    if status != "ok":
        raise ThreatFeedError("unexpected_payload")
    data = body.get("data")
    if data is None:
        return FeedBatch((), 0)
    if not isinstance(data, list):
        raise ThreatFeedError("unexpected_payload")
    records: list[NormalizedIoc] = []
    skipped = 0
    for item in data:
        if len(records) >= limit:
            skipped += 1
            continue
        parsed = _item(item)
        if parsed is None:
            skipped += 1
            continue
        records.append(parsed)
    return FeedBatch(tuple(records), skipped)


def _item(item: object) -> NormalizedIoc | None:
    if not isinstance(item, dict):
        return None
    try:
        return _parse_item(item)
    except TypeError, ValueError:
        return None


def _parse_item(item: dict[object, object]) -> NormalizedIoc | None:
    raw_type = item.get("ioc_type")
    raw_value = item.get("ioc")
    if not isinstance(raw_type, str) or not isinstance(raw_value, str):
        return None
    mapped = _map_indicator(raw_type.strip().lower(), raw_value)
    if mapped is None:
        return None
    subtype, observed, normalized = mapped
    malware = bounded_text(item.get("malware_printable"), 120) or bounded_text(
        item.get("malware"), 120
    )
    threat = bounded_text(item.get("threat_type"), 64)
    summary = "ThreatFox lists this indicator"
    if threat:
        summary += f" as {threat}"
    summary += "."
    if malware:
        summary += f" Malware family: {malware}."
    summary += " Presence in ThreatFox is not an asset compromise or an ATT&CK mapping."
    return NormalizedIoc(
        source_name="threatfox",
        source_record_id=source_record_id(item.get("id")),
        indicator_type=coarse_type(subtype),
        indicator_subtype=subtype,
        observed_value=observed,
        normalized_value=normalized,
        threat_type=threat,
        malware_family=malware,
        first_seen=parse_source_time(item.get("first_seen")),
        last_seen=parse_source_time(item.get("last_seen")),
        tags=source_tags(item.get("tags")),
        source_confidence=source_confidence(item.get("confidence_level")),
        source_status=None,
        reference_url=public_https_url(item.get("reference")),
        summary=summary,
    )


def _map_indicator(ioc_type: str, value: str) -> tuple[str, str, str] | None:
    observed = value.strip()
    if not observed or len(observed) > 2048:
        return None
    if ioc_type in {"domain", "hostname"}:
        normalized = normalize_domain(observed)
        if normalized is None:
            return None
        subtype = "hostname" if ioc_type == "hostname" else "domain"
        return subtype, observed, normalized
    if ioc_type == "url":
        normalized = normalize_url(observed)
        if normalized is None:
            return None
        return "url", observed, normalized
    if ioc_type == "ip:port":
        parsed = normalize_ip_port(observed)
        if parsed is None:
            return None
        subtype, normalized = parsed
        return subtype, observed, normalized
    subtype = _HASH_TYPES.get(ioc_type)
    if subtype is None:
        return None
    normalized = normalize_hash(observed, subtype)
    if normalized is None:
        return None
    return subtype, observed, normalized


def _record_limit(settings: Settings) -> int:
    return min(1000, max(1, settings.threat_intel_ioc_limit))
