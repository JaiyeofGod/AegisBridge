"""Normalized indicator records produced by the feed adapters."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class NormalizedIoc:
    """One validated indicator. ``fetched_at`` is applied later, at ingest time."""

    source_name: str
    source_record_id: str | None
    indicator_type: str
    indicator_subtype: str
    observed_value: str
    normalized_value: str
    threat_type: str | None
    malware_family: str | None
    first_seen: datetime | None
    last_seen: datetime | None
    tags: tuple[str, ...]
    source_confidence: int | None
    source_status: str | None
    reference_url: str | None
    summary: str


@dataclass(frozen=True)
class FeedBatch:
    """Valid records, plus how many items were skipped or cut by the record cap."""

    records: tuple[NormalizedIoc, ...]
    skipped: int
