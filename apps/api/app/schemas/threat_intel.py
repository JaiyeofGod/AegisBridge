"""Threat-intelligence contracts. External feeds are not implied by these shapes."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import RelatedRecord


class SourceRef(BaseModel):
    id: str
    name: str
    connection_status: str


class AttackRef(BaseModel):
    technique_id: str
    name: str
    tactic: str


class ThreatIntelSummary(BaseModel):
    active_indicator_count: int
    internal_match_count: int
    advisory_count: int
    source_health: dict[str, int]
    data_origin: str
    semantics: str


class IndicatorListItem(BaseModel):
    id: str
    indicator_type: str
    value: str
    confidence: str
    severity: str | None
    source: SourceRef
    first_seen: datetime
    last_seen: datetime
    status: str
    internal_match: bool
    attack_technique_id: str | None
    matched_asset_id: str | None


class IndicatorDetail(IndicatorListItem):
    summary: str
    attack: AttackRef | None
    matched_asset: RelatedRecord | None
    data_origin: str


class AdvisoryListItem(BaseModel):
    id: str
    title: str
    summary: str
    status: str
    confidence: str | None
    related_cve: str | None
    published_at: datetime | None
    source: SourceRef


class ThreatSourceItem(BaseModel):
    id: str
    name: str
    provider: str
    purpose: str
    connection_status: str
    notes: str | None
