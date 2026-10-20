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


class AlertDetail(AlertListItem):
    detection_status: str | None
    detection_version: str | None
    detection_logic_summary: str | None
    attack_version: str | None
    investigation_status: str | None
    investigation_summary: str | None
