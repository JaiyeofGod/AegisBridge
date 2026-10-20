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
