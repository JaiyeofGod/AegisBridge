"""Cyber-range read contracts. No remote-control or inbound lab management fields."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import RelatedRecord


class AttackTechniqueRef(BaseModel):
    id: str
    name: str
    tactic: str | None


class CyberRangeSummary(BaseModel):
    zone_count: int
    expected_system_count: int
    active_observed_system_count: int
    telemetry_active_count: int
    telemetry_expected_count: int
    scenarios_ready_count: int
    scenarios_total_count: int
    scenarios_running_count: int
    detection_coverage_count: int
    lab_bridge_status: str
    lab_bridge_freshness: str | None
    last_successful_lab_sync_at: datetime | None
    freshness_state: str
    data_origin: str
    semantics: str


class LabZoneItem(BaseModel):
    id: str
    name: str
    cidr: str
    gateway: str | None
    purpose: str
    status: str
    observed_state: str
    isolation_notes: str | None
    system_count: int
    notes: str | None


class LabSystemListItem(BaseModel):
    id: str
    hostname: str
    zone: RelatedRecord
    ip_address: str | None
    role: str
    platform: str | None
    expected_state: str
    observed_state: str
    telemetry_status: str
    last_seen_at: datetime | None
    source_origin: str
    notes: str | None


class LabSystemRelationshipItem(BaseModel):
    """Directed catalog association. Not live reachability or observed traffic."""

    id: str
    source_system_id: str
    target_system_id: str
    relationship_kind: str


class LabSystemDetail(LabSystemListItem):
    telemetry_source: str | None
    telemetry_expected: bool
    telemetry_freshness: str | None
    telemetry_semantics: str | None


class LabScenarioListItem(BaseModel):
    id: str
    name: str
    objective: str
    status: str
    category: str
    attack_techniques: list[AttackTechniqueRef]
    expected_system_ids: list[str]
    expected_detection_ids: list[str]
    last_run_at: datetime | None
    safety_notes: str | None


class LabScenarioDetail(LabScenarioListItem):
    expected_telemetry: str | None
    notes: str | None


class LabTelemetryItem(BaseModel):
    system_id: str
    hostname: str
    telemetry_source: str | None
    expected: bool
    status: str
    last_seen_at: datetime | None
    freshness: str | None
    semantics: str | None


class LabDetectionItem(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    data_source: str | None
    sigma_reference: str | None
    wazuh_mapping_status: str | None
    validation_state: str | None
    last_validated_at: datetime | None
    attack_techniques: list[AttackTechniqueRef]
    notes: str | None
