"""abuse.ch URLhaus recent-URL adapter.

Official request: GET https://urlhaus-api.abuse.ch/v1/urls/recent/
with the Auth-Key header. A listed URL is a feed observation only.
"""

from __future__ import annotations

from app.core.config import Settings
from app.integrations.threat_intel.errors import ThreatFeedError
from app.integrations.threat_intel.http import FeedClient
from app.integrations.threat_intel.models import FeedBatch, NormalizedIoc
from app.integrations.threat_intel.normalize import (
    bounded_text,
    normalize_url,
    parse_source_time,
    public_https_url,
    source_record_id,
    source_status,
    source_tags,
)

URLHAUS_URL = "https://urlhaus-api.abuse.ch/v1/urls/recent/"


def fetch_urlhaus(settings: Settings, client: FeedClient) -> FeedBatch:
    if settings.urlhaus_recent_url != URLHAUS_URL:
        raise ThreatFeedError("endpoint_rejected")
    body = client.request("GET", URLHAUS_URL)
    return parse_urlhaus(body, limit=min(1000, max(1, settings.threat_intel_ioc_limit)))


def parse_urlhaus(body: object, *, limit: int) -> FeedBatch:
    if not isinstance(body, dict):
        raise ThreatFeedError("unexpected_payload")
    status = body.get("query_status")
    if status == "no_results":
        return FeedBatch((), 0)
    if status not in {None, "ok"}:
        raise ThreatFeedError("unexpected_payload")
    rows = body.get("urls")
    if rows is None:
        rows = body.get("data")
    if rows is None:
        return FeedBatch((), 0)
    if not isinstance(rows, list):
        raise ThreatFeedError("unexpected_payload")
    records: list[NormalizedIoc] = []
    skipped = 0
    for item in rows:
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
    raw_url = item.get("url")
    if not isinstance(raw_url, str):
        return None
    observed = raw_url.strip()
    normalized = normalize_url(observed)
    if normalized is None:
        return None
    threat = bounded_text(item.get("threat"), 64)
    status = source_status(item.get("url_status"))
    host = bounded_text(item.get("host"), 255)
    summary = "URLhaus lists this URL"
    if threat:
        summary += f" as {threat}"
    summary += "."
    if status:
        summary += f" URL status: {status}."
    if host:
        summary += f" Host context: {host}."
    summary += " Presence in URLhaus is not an asset compromise, exploitation, or infection."
    first_seen = parse_source_time(item.get("date_added"))
    last_seen = parse_source_time(item.get("last_online")) or first_seen
    return NormalizedIoc(
        source_name="urlhaus",
        source_record_id=source_record_id(item.get("id")),
        indicator_type="url",
        indicator_subtype="url",
        observed_value=observed,
        normalized_value=normalized,
        threat_type=threat,
        malware_family=None,
        first_seen=first_seen,
        last_seen=last_seen,
        tags=source_tags(item.get("tags")),
        source_confidence=None,
        source_status=status,
        reference_url=public_https_url(item.get("urlhaus_reference")),
        summary=summary,
    )
