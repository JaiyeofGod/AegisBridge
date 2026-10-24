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


class VulnerabilityNvdRead(BaseModel):
    """NVD timestamps already stored for this CVE. Null means the value is absent."""

    published_at: datetime | None = Field(description="NVD published time. Not a fetch time.")
    source_modified_at: datetime | None = Field(description="NVD last-modified time for the CVE.")
    fetched_at: datetime | None = Field(
        description="When AegisBridge last successfully fetched this CVE from NVD."
    )


class VulnerabilityKevRead(BaseModel):
    """Stored CISA KEV catalog metadata. Listing is not a compromise finding."""

    checked_at: datetime | None = Field(
        description="When AegisBridge last successfully checked KEV membership."
    )
    due_on: date | None
    required_action: str | None
    vendor_project: str | None
    product: str | None


class VulnerabilityEpssRead(BaseModel):
    """The same latest EPSS snapshot already selected for epss and epss_percentile."""

    observed_on: date | None
    fetched_at: datetime | None = Field(
        description="When AegisBridge fetched the selected EPSS observation."
    )


class VulnerabilityIntelligenceRead(BaseModel):
    """Persisted source provenance. Not a score and not remediation state."""

    nvd: VulnerabilityNvdRead
    kev: VulnerabilityKevRead
    epss: VulnerabilityEpssRead


class VulnerabilityDetail(VulnerabilityListItem):
    cve_summary: str | None
    intelligence: VulnerabilityIntelligenceRead


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
