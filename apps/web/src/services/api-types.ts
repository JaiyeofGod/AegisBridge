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

export type AlertListItem = {
  id: string;
  severity: string;
  status: string;
  summary: string;
  observed_at: string;
  telemetry_source: string;
  wazuh_alert_id: string | null;
  source_of_record: string;
  stored_scope: string;
  asset_id: string | null;
  asset_hostname: string | null;
  detection_id: string | null;
  detection_name: string | null;
  attack_technique_id: string | null;
  attack_technique_name: string | null;
  attack_tactic: string | null;
  investigation_id: string | null;
  assignee: PersonRef | null;
};

export type AlertDetailResponse = AlertListItem & {
  detection_status: string | null;
  detection_version: string | null;
  detection_logic_summary: string | null;
  attack_version: string | null;
  investigation_status: string | null;
  investigation_summary: string | null;
};

export type AlertQuery = {
  search?: string;
  severity?: string;
  status?: string;
  asset?: string;
  attackTechnique?: string;
  page?: number;
  pageSize?: number;
};

export type IncidentListItem = {
  id: string;
  title: string;
  severity: string;
  status: string;
  containment_state: string | null;
  summary: string;
  owner: PersonRef | null;
  open_task_count: number;
  evidence_count: number;
};

export type IncidentTimelineEvent = {
  occurred_at: string;
  summary: string;
};

export type IncidentTaskItem = {
  title: string;
  status: string;
  assignee: PersonRef | null;
};

export type IncidentIndicatorItem = {
  kind: string;
  value: string;
  confidence: string;
};

export type IncidentEvidenceItem = {
  id: string;
  title: string;
  sha256: string | null;
  collected_at: string | null;
  note: string | null;
};

export type IncidentDetailResponse = IncidentListItem & {
  timeline: IncidentTimelineEvent[];
  tasks: IncidentTaskItem[];
  indicators: IncidentIndicatorItem[];
  evidence: IncidentEvidenceItem[];
  related_alerts: RelatedRecord[];
  affected_assets: RelatedRecord[];
};

export type IncidentQuery = {
  search?: string;
  severity?: string;
  status?: string;
  owner?: string;
  containmentState?: string;
  page?: number;
  pageSize?: number;
};

export type FrameworkSummary = {
  code: string;
  name: string;
  version: string | null;
  control_count: number;
  licensed_text_included: boolean;
};

export type ControlImplementationCounts = {
  by_status: Record<string, number>;
  tests_passed: number;
  tests_recorded: number;
  assessed_applicable: number;
};

export type EvidenceFreshness = {
  recorded: number;
  with_sha256: number;
  missing_collected_at: number;
  semantics: string;
};

export type AssessmentWork = {
  tests_recorded: number;
  items: string[];
};

export type PolicyStatusItem = {
  id: string;
  title: string;
  status: string;
  current_version: string | null;
  acknowledgement_count: number;
  owner: PersonRef | null;
};

export type AccessReviewStatusItem = {
  id: string;
  name: string;
  status: string;
  open_findings: number;
  total_findings: number;
};

export type GovernanceSummary = {
  frameworks: FrameworkSummary[];
  control_implementations: ControlImplementationCounts;
  evidence_freshness: EvidenceFreshness;
  assessment_work: AssessmentWork;
  policies: PolicyStatusItem[];
  access_reviews: AccessReviewStatusItem[];
};

export type ThreatSourceRef = {
  id: string;
  name: string;
  connection_status: string;
};

export type AttackRef = {
  technique_id: string;
  name: string;
  tactic: string;
};

export type ThreatIntelSummary = {
  active_indicator_count: number;
  internal_match_count: number;
  advisory_count: number;
  source_health: Record<string, number>;
  data_origin: string;
  semantics: string;
};

export type IndicatorListItem = {
  id: string;
  indicator_type: string;
  value: string;
  confidence: string;
  severity: string | null;
  source: ThreatSourceRef;
  first_seen: string;
  last_seen: string;
  status: string;
  internal_match: boolean;
  attack_technique_id: string | null;
  matched_asset_id: string | null;
};

export type IndicatorDetailResponse = IndicatorListItem & {
  summary: string;
  attack: AttackRef | null;
  matched_asset: RelatedRecord | null;
  data_origin: string;
};

export type IndicatorQuery = {
  search?: string;
  indicatorType?: string;
  source?: string;
  status?: string;
  internalMatch?: boolean;
  page?: number;
  pageSize?: number;
};

export type AdvisoryListItem = {
  id: string;
  title: string;
  summary: string;
  status: string;
  confidence: string | null;
  related_cve: string | null;
  published_at: string | null;
  source: ThreatSourceRef;
};

export type ThreatSourceItem = {
  id: string;
  name: string;
  provider: string;
  purpose: string;
  connection_status: string;
  notes: string | null;
};

export type AdministrationSummary = {
  configured_integration_count: number;
  integration_status: Record<string, number>;
  integration_freshness: Record<string, number>;
  active_user_count: number;
  privileged_user_count: number;
  recent_audit_event_count: number;
  pending_access_review_count: number;
  privileged_roles: string[];
  semantics: string;
};

export type IntegrationListItem = {
  id: string;
  name: string;
  provider: string;
  status: string;
  freshness: string | null;
  last_sync_at: string | null;
  last_success_at: string | null;
  credential_state: string;
  notes: string | null;
};

export type AdminUserListItem = {
  id: string;
  display_name: string;
  email: string;
  status: string;
  department: string | null;
  roles: string[];
  privileged: boolean;
};

export type AdminRoleListItem = {
  id: string;
  name: string;
  summary: string;
  permissions: string[];
};

export type AuditEventListItem = {
  id: string;
  occurred_at: string;
  actor: PersonRef | null;
  actor_label: string;
  action: string;
  object_type: string;
  object_id: string;
  result: string;
  source: string;
  environment_name: string;
  detail: string | null;
};

export type AccessReviewListItem = {
  id: string;
  name: string;
  status: string;
  owner: PersonRef | null;
  open_finding_count: number;
  total_finding_count: number;
  due_at: string | null;
};

export type ReportsSummary = {
  report_definition_count: number;
  scheduled_report_count: number;
  completed_report_count: number;
  failed_report_count: number;
  recent_execution_count: number;
  dataset_count: number;
  dataset_quality_review_count: number;
  experiment_count: number;
  semantics: string;
};

export type ReportDefinitionListItem = {
  id: string;
  name: string;
  description: string;
  report_type: string;
  status: string;
  schedule_state: string;
  schedule_label: string | null;
  format_label: string | null;
  owner: PersonRef | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  next_run_at: string | null;
};

export type ReportDefinitionDetail = ReportDefinitionListItem & {
  generated_files: string[];
};

export type ReportDefinitionQuery = {
  search?: string;
  status?: string;
  reportType?: string;
  page?: number;
  pageSize?: number;
};

export type DatasetListItem = {
  id: string;
  name: string;
  description: string | null;
  publisher: string | null;
  source_label: string | null;
  source_url: string | null;
  publication_year: number | null;
  domain: string | null;
  license_label: string | null;
  status: string;
  verification_status: string | null;
  purpose: string | null;
  size_label: string | null;
  row_count: number | null;
  feature_count: number | null;
  file_count: number;
  version_count: number;
  experiment_count: number;
  created_at: string;
  updated_at: string;
  notes: string | null;
};

export type DatasetFileItem = {
  filename: string;
  sha256: string | null;
  size_bytes: number | null;
  has_storage_uri: boolean;
};

export type DatasetVersionItem = {
  version_label: string;
  file_count: number;
  experiment_count: number;
  created_at: string;
};

export type DatasetExperimentRef = {
  id: string;
  name: string;
  status: string;
  experiment_type: string | null;
};

export type DatasetDetail = DatasetListItem & {
  versions: DatasetVersionItem[];
  files: DatasetFileItem[];
  experiments: DatasetExperimentRef[];
};

export type DatasetQuery = {
  search?: string;
  status?: string;
  domain?: string;
  verificationStatus?: string;
  publicationYear?: number;
  page?: number;
  pageSize?: number;
};

export type ExperimentListItem = {
  id: string;
  name: string;
  status: string;
  experiment_type: string | null;
  approach: string | null;
  metrics_summary: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  dataset: RelatedRecord;
};

export type ExperimentDetail = ExperimentListItem & {
  dataset_version_label: string;
};

export type ExperimentQuery = {
  search?: string;
  status?: string;
  datasetId?: string;
  experimentType?: string;
  page?: number;
  pageSize?: number;
};
