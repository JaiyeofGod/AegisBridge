"""Vulnerability contract. Factors stay independent. There is no combined score."""

from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.common import PersonRef, RelatedRecord


class VulnerabilityAssetContext(BaseModel):
    asset_id: str
    hostname: str
    exposure: str
    asset_criticality: str
    status: str
    action_decision: str | None
    action_rationale: str | None
    action_assessed_at: datetime | None
    remediation_status: str | None
    remediation_title: str | None
    due_on: date | None
    owner: PersonRef | None = None
    mitigating_controls: list[RelatedRecord]


class VulnerabilityListItem(BaseModel):
    id: str
    title: str
    cve_id: str | None
    cvss_version: str | None
    cvss_base_score: float | None
    cvss_vector: str | None
    cvss_severity: str | None
    epss: float | None
    epss_percentile: float | None
    epss_observed_on: date | None
    kev_listed: bool
    kev_date_added: date | None
    known_ransomware_use: str | None
    assets: list[VulnerabilityAssetContext]


class VulnerabilityDetail(VulnerabilityListItem):
    cve_summary: str | None
