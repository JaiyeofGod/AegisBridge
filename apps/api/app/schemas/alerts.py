"""Selected alert references. Raw Wazuh events are not part of this contract."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import PersonRef


class AlertListItem(BaseModel):
    id: str
    severity: str
    status: str
    summary: str
    observed_at: datetime
    telemetry_source: str
    wazuh_alert_id: str | None
    source_of_record: str
    stored_scope: str
    asset_id: str | None
    asset_hostname: str | None
    detection_id: str | None
    detection_name: str | None
    attack_technique_id: str | None
    attack_technique_name: str | None
    attack_tactic: str | None
    investigation_id: str | None
    assignee: PersonRef | None = None
    data_origin: str


class SourceTechniqueRef(BaseModel):
    """ATT&CK id supplied by the alert source. Name is filled only from the catalog."""

    id: str
    name: str | None = None


class AlertDetail(AlertListItem):
    detection_status: str | None
    detection_version: str | None
    detection_logic_summary: str | None
    attack_version: str | None
    investigation_status: str | None
    investigation_summary: str | None
    source_rule_id: str | None = None
    source_rule_level: int | None = None
    source_agent_id: str | None = None
    source_agent_name: str | None = None
    source_fetched_at: datetime | None = None
    source_src_ip: str | None = None
    source_dst_ip: str | None = None
    source_username: str | None = None
    attack_technique_ids: list[SourceTechniqueRef] = []
