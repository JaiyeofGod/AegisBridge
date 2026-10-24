"""Vulnerability contract. Factors stay independent. There is no combined score."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PersonRef, RelatedRecord

RemediationStatus = Literal[
    "open",
    "in_progress",
    "complete",
    "deferred",
    "cancelled",
    "accepted",
]


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
    remediation_updated_at: datetime | None = None


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


class VulnerabilityRemediationUpdate(BaseModel):
    """Partial remediation patch. Enrichment factors (CVSS/EPSS/KEV/SSVC) are immutable here."""

    model_config = ConfigDict(extra="forbid")

    status: RemediationStatus | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    due_on: date | None = None
    owner: str | None = Field(
        default=None,
        description="Remediation owner user human id. Null clears the owner.",
    )
    asset_id: str | None = Field(
        default=None,
        description=(
            "Selector only: asset human id used to disambiguate which existing "
            "asset finding's remediation task to update when the vulnerability "
            "has multiple findings. Must already be associated with the "
            "vulnerability. Does not reassign or move the remediation task."
        ),
    )
    expected_updated_at: datetime | None = None


class IntelligenceSourceResult(BaseModel):
    """One external source outcome. Raw feed bodies are not included."""

    source: str
    status: str
    detail: str | None = None


class IntelligenceRefreshResult(BaseModel):
    """On-demand CVE refresh. Remediation and action_decision are not part of this result."""

    vulnerability_id: str
    cve: str
    fetched_at: datetime
    sources: list[IntelligenceSourceResult]
