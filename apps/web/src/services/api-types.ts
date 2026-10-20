/** JSON contracts for the read-only FastAPI routes. Field names match the API. */

export type PersonRef = {
  id: string;
  display_name: string;
};

export type RelatedRecord = {
  id: string;
  title: string;
  status: string | null;
  summary: string | null;
};

export type PageResponse<T> = {
  page: number;
  page_size: number;
  total: number;
  items: T[];
};

export type OverviewResponse = {
  generated_at: string;
  organization_name: string | null;
  data_origin: string | null;
  environment_label: string | null;
  kev_exposure: {
    exposed_asset_count: number;
    distinct_cve_count: number;
    asset_ids: string[];
    cve_ids: string[];
    semantics: string;
  };
  open_incidents: number;
  control_posture: {
    passed: number;
    assessed_applicable: number;
    semantics: string;
  };
  telemetry: {
    active: number;
    expected: number;
    semantics: string;
  };
  my_work: Array<{
    id: string;
    kind: string;
    title: string;
    status: string;
    owner: PersonRef | null;
  }>;
  security_highlights: Array<{ id: string; title: string; detail: string }>;
  executive_notes: Array<{ id: string; title: string; detail: string }>;
};

export type AssetListItem = {
  id: string;
  hostname: string;
  name: string;
  asset_type: string;
  asset_type_code: string;
  criticality: string;
  exposure: string;
  environment: string;
  telemetry_status: string;
  lifecycle: string;
  platform: string | null;
  last_seen_at: string | null;
  owner: PersonRef | null;
};

export type AssetDetailResponse = AssetListItem & {
  os_version: string | null;
  ip_address: string | null;
  data_classification: string;
  software: string[];
  vulnerabilities: RelatedRecord[];
  alerts: RelatedRecord[];
  risks: RelatedRecord[];
  controls: RelatedRecord[];
  evidence: RelatedRecord[];
};

export type AssetQuery = {
  search?: string;
  assetType?: string;
  criticality?: string;
  environment?: string;
  telemetryStatus?: string;
  page?: number;
  pageSize?: number;
};

export type RiskListItem = {
  id: string;
  title: string;
  status: string;
  methodology: string;
  methodology_label: string;
  likelihood: number | null;
  impact: number | null;
  score: number | null;
  residual_likelihood: number | null;
  residual_impact: number | null;
  residual_score: number | null;
  risk_level: string | null;
  treatment_strategy: string | null;
  treatment_status: string | null;
  owner: PersonRef | null;
  asset_id: string | null;
  asset_hostname: string | null;
};

export type RiskDetailResponse = RiskListItem & {
  statement: string;
  treatment_notes: string | null;
  evidence: RelatedRecord[];
  reviews: RelatedRecord[];
};

export type RiskQuery = {
  search?: string;
  riskLevel?: string;
  treatmentStatus?: string;
  owner?: string;
  page?: number;
  pageSize?: number;
};

export type VulnerabilityAssetContext = {
  asset_id: string;
  hostname: string;
  exposure: string;
  asset_criticality: string;
  status: string;
  action_decision: string | null;
  action_rationale: string | null;
  action_assessed_at: string | null;
  remediation_status: string | null;
  remediation_title: string | null;
  due_on: string | null;
  owner: PersonRef | null;
  mitigating_controls: RelatedRecord[];
};

export type VulnerabilityListItem = {
  id: string;
  title: string;
  cve_id: string | null;
  cvss_version: string | null;
  cvss_base_score: number | null;
  cvss_vector: string | null;
  cvss_severity: string | null;
  epss: number | null;
  epss_percentile: number | null;
  epss_observed_on: string | null;
  kev_listed: boolean;
  kev_date_added: string | null;
  known_ransomware_use: string | null;
  assets: VulnerabilityAssetContext[];
};

export type VulnerabilityDetailResponse = VulnerabilityListItem & {
  cve_summary: string | null;
};

export type VulnerabilityQuery = {
  search?: string;
  severity?: string;
  kev?: boolean;
  actionDecision?: string;
  remediationStatus?: string;
  assetCriticality?: string;
  page?: number;
  pageSize?: number;
};
