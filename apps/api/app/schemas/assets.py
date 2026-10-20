"""Asset list and detail contracts."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import PersonRef, RelatedRecord


class AssetListItem(BaseModel):
    id: str
    hostname: str
    name: str
    asset_type: str
    asset_type_code: str
    criticality: str
    exposure: str
    environment: str
    telemetry_status: str
    lifecycle: str
    platform: str | None
    last_seen_at: datetime | None
    owner: PersonRef | None = None


class AssetDetail(AssetListItem):
    os_version: str | None
    ip_address: str | None
    data_classification: str
    software: list[str]
    vulnerabilities: list[RelatedRecord]
    alerts: list[RelatedRecord]
    risks: list[RelatedRecord]
    controls: list[RelatedRecord]
    evidence: list[RelatedRecord]
