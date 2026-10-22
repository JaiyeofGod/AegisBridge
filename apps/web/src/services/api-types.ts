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
  treatment_updated_at?: string | null;
};

export type TreatmentStrategyValue = "accept" | "avoid" | "mitigate" | "transfer";
export type TreatmentStatusValue =
  "planned" | "in_progress" | "complete" | "deferred" | "cancelled";

export type RiskTreatmentUpdate = {
  strategy?: TreatmentStrategyValue;
  status?: TreatmentStatusValue;
  notes?: string;
  expected_updated_at?: string | null;
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
  remediation_updated_at?: string | null;
};

export type RemediationStatusValue =
  "open" | "in_progress" | "complete" | "deferred" | "cancelled" | "accepted";

export type VulnerabilityRemediationUpdate = {
  status?: RemediationStatusValue;
  title?: string;
  due_on?: string | null;
  owner?: string | null;
  /** Selector only — must already be associated with the vulnerability. */
  asset_id?: string;
  expected_updated_at?: string | null;
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
  updated_at?: string | null;
};

export type IncidentSeverityValue = "critical" | "high" | "medium" | "low" | "informational";

export type IncidentStatusValue =
  "new" | "investigating" | "contained" | "mitigated" | "resolved" | "closed";

export type IncidentUpdate = {
  title?: string;
  severity?: IncidentSeverityValue;
  status?: IncidentStatusValue;
  summary?: string;
  owner?: string | null;
  expected_updated_at?: string | null;
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

export type PolicyLifecycleStatus = "draft" | "in_review" | "approved" | "published" | "retired";

export type PolicyVersionStatus = "draft" | "published" | "superseded";

export type PolicyVersionSummary = {
  version_label: string;
  status: PolicyVersionStatus;
  is_current: boolean;
  change_summary: string | null;
  acknowledgement_count: number;
  updated_at: string | null;
};

export type PolicyVersionDetail = {
  policy_id: string;
  version_label: string;
  status: PolicyVersionStatus;
  is_current: boolean;
  content: string;
  change_summary: string | null;
  acknowledgement_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type PolicyAcknowledgementSummary = {
  current_version_label: string | null;
  acknowledgement_count: number;
  current_user_acknowledged: boolean;
  current_user_acknowledged_at: string | null;
  semantics: string;
};

export type PolicyListItem = {
  id: string;
  title: string;
  status: PolicyLifecycleStatus;
  owner: PersonRef | null;
  current_version: string | null;
  acknowledgement_count: number;
  updated_at: string | null;
};

export type PolicyDetail = {
  id: string;
  title: string;
  status: PolicyLifecycleStatus;
  owner: PersonRef | null;
  current_version: string | null;
  versions: PolicyVersionSummary[];
  acknowledgements: PolicyAcknowledgementSummary;
  created_at: string | null;
  updated_at: string | null;
  control_mappings: string[];
  semantics: string;
};

export type PolicyCreate = {
  title: string;
  owner?: string | null;
  initial_version_label?: string;
  initial_content?: string;
  change_summary?: string | null;
};

export type PolicyUpdate = {
  title?: string;
  owner?: string | null;
  expected_updated_at?: string | null;
};

export type PolicyVersionCreate = {
  version_label: string;
  content: string;
  change_summary?: string | null;
};

export type PolicyVersionUpdate = {
  content?: string;
  change_summary?: string | null;
  expected_updated_at?: string | null;
};

export type PolicyTransition = {
  to_status: PolicyLifecycleStatus;
  version_label?: string | null;
  expected_updated_at?: string | null;
};

export type PolicyAcknowledgeResult = {
  policy_id: string;
  version_label: string;
  acknowledged: boolean;
  acknowledged_at: string;
  already_acknowledged: boolean;
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

export type ControlImplementationStatusValue =
  "planned" | "partial" | "implemented" | "not_implemented" | "not_applicable";

export type ControlTestResultValue = "pass" | "fail" | "partial" | "inconclusive";

export type EvidenceClassificationValue = "simulated" | "internal" | "confidential" | "restricted";

export type ControlListItem = {
  id: string;
  control_code: string;
  title: string;
  family: string | null;
  framework_code: string | null;
  framework_version: string | null;
  implementation_status: string | null;
  test_count: number;
  evidence_count: number;
};

export type ControlImplementationDetail = {
  status: string;
  notes: string | null;
  owner: PersonRef | null;
  updated_at: string | null;
};

export type ControlTestItem = {
  id: string;
  control_id: string;
  result: string;
  tested_at: string;
  tester: PersonRef | null;
  notes: string | null;
  updated_at: string | null;
  recording_mode: string;
};

export type ControlEvidenceItem = {
  id: string;
  title: string;
  sha256: string | null;
  collected_at: string | null;
};

export type ControlDetail = ControlListItem & {
  implementation: ControlImplementationDetail | null;
  tests: ControlTestItem[];
  evidence: ControlEvidenceItem[];
  licensed_text_included: boolean;
  updated_at: string | null;
};

export type ControlImplementationUpdate = {
  status?: ControlImplementationStatusValue;
  notes?: string | null;
  owner?: string | null;
  expected_updated_at?: string | null;
};

export type ControlTestCreate = {
  result: ControlTestResultValue;
  tested_at?: string | null;
  tester?: string | null;
  notes?: string | null;
};

export type ControlTestUpdate = {
  result?: ControlTestResultValue;
  tested_at?: string | null;
  tester?: string | null;
  notes?: string | null;
  expected_updated_at?: string | null;
};

export type EvidenceDetail = {
  id: string;
  title: string;
  description: string | null;
  version_label: string;
  sha256: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  data_classification: string;
  collected_at: string | null;
  collected_by: PersonRef | null;
  control_ids: string[];
  updated_at: string | null;
  object_stored: boolean;
  integrity_verified: boolean;
  original_filename: string | null;
  stored_at: string | null;
  storage_provider: string | null;
  content_type: string | null;
  hash_source: string | null;
  semantics: string;
};

export type EvidenceObjectDeleteResult = {
  evidence_id: string;
  object_stored: boolean;
  deleted: boolean;
};

/** Development default matching API EVIDENCE_MAX_UPLOAD_BYTES (25 MiB). */
export const EVIDENCE_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type EvidenceCreate = {
  title: string;
  description?: string | null;
  version_label?: string;
  sha256?: string | null;
  size_bytes?: number | null;
  mime_type?: string | null;
  data_classification?: EvidenceClassificationValue;
  collected_at?: string | null;
  collected_by?: string | null;
};

export type ControlEvidenceLinkResult = {
  control_id: string;
  evidence_id: string;
  linked: boolean;
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
  updated_at?: string | null;
};

/** User row returned by administration user mutations. */
export type UserAdminDetail = AdminUserListItem & {
  permissions: string[];
};

export type AdminAccountStatus = "active" | "inactive";

export type AccessReviewStatusValue = "in_progress" | "closed" | "completed" | "cancelled";

export type AccessReviewUpdate = {
  name?: string;
  status?: AccessReviewStatusValue;
  expected_updated_at?: string | null;
};

export type UserStatusUpdate = {
  status?: AdminAccountStatus;
  expected_updated_at?: string | null;
};

export type UserRolesUpdate = {
  roles: string[];
  expected_updated_at?: string | null;
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
  updated_at?: string | null;
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

export type CyberRangeSummary = {
  zone_count: number;
  expected_system_count: number;
  active_observed_system_count: number;
  telemetry_active_count: number;
  telemetry_expected_count: number;
  scenarios_ready_count: number;
  scenarios_total_count: number;
  scenarios_running_count: number;
  detection_coverage_count: number;
  lab_bridge_status: string;
  lab_bridge_freshness: string | null;
  last_successful_lab_sync_at: string | null;
  freshness_state: string;
  data_origin: string;
  semantics: string;
};

export type AttackTechniqueRef = {
  id: string;
  name: string;
  tactic: string | null;
};

export type LabZoneItem = {
  id: string;
  name: string;
  cidr: string;
  gateway: string | null;
  purpose: string;
  status: string;
  observed_state: string;
  isolation_notes: string | null;
  system_count: number;
  notes: string | null;
};

export type LabSystemListItem = {
  id: string;
  hostname: string;
  zone: RelatedRecord;
  ip_address: string | null;
  role: string;
  platform: string | null;
  expected_state: string;
  observed_state: string;
  telemetry_status: string;
  last_seen_at: string | null;
  source_origin: string;
  notes: string | null;
};

export type LabSystemDetail = LabSystemListItem & {
  telemetry_source: string | null;
  telemetry_expected: boolean;
  telemetry_freshness: string | null;
  telemetry_semantics: string | null;
};

export type LabSystemQuery = {
  search?: string;
  zone?: string;
  role?: string;
  telemetryStatus?: string;
  observedState?: string;
  page?: number;
  pageSize?: number;
};

export type LabScenarioListItem = {
  id: string;
  name: string;
  objective: string;
  status: string;
  category: string;
  attack_techniques: AttackTechniqueRef[];
  expected_system_ids: string[];
  expected_detection_ids: string[];
  last_run_at: string | null;
  safety_notes: string | null;
};

export type LabScenarioDetail = LabScenarioListItem & {
  expected_telemetry: string | null;
  notes: string | null;
};

export type LabScenarioQuery = {
  search?: string;
  status?: string;
  category?: string;
  attackTechnique?: string;
  page?: number;
  pageSize?: number;
};

export type LabTelemetryItem = {
  system_id: string;
  hostname: string;
  telemetry_source: string | null;
  expected: boolean;
  status: string;
  last_seen_at: string | null;
  freshness: string | null;
  semantics: string | null;
};

export type LabDetectionItem = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  data_source: string | null;
  sigma_reference: string | null;
  wazuh_mapping_status: string | null;
  validation_state: string | null;
  last_validated_at: string | null;
  attack_techniques: AttackTechniqueRef[];
  notes: string | null;
};

export type LabDetectionQuery = {
  search?: string;
  validationState?: string;
  attackTechnique?: string;
  dataSource?: string;
  page?: number;
  pageSize?: number;
};

export type CurrentUser = {
  id: string;
  display_name: string;
  email: string;
  status: string;
  department: string | null;
  roles: string[];
  permissions: string[];
  privileged: boolean;
  organization: string;
  environment_label: string;
  data_origin: string;
  job_title: string | null;
  timezone: string | null;
};

/** Login payload. csrf_token is not the session cookie value. */
export type LoginResponse = CurrentUser & {
  csrf_token: string;
};

export type SessionStatus = {
  authenticated: boolean;
  user: CurrentUser | null;
  session_id: string | null;
  expires_at: string | null;
  last_seen_at: string | null;
};

export type AccountProfileResponse = {
  id: string;
  display_name: string;
  email: string;
  department: string | null;
  account_status: string;
  job_title: string | null;
  timezone: string;
  organization: string;
  created_at: string;
  data_origin: string;
};

export type AccountSessionSummary = {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  current: boolean;
};

export type AccountSecurityResponse = {
  password_authentication_configured: boolean;
  active_session_count: number;
  current_session: AccountSessionSummary | null;
  mfa_status: string;
  last_authenticated_at: string | null;
  semantics: string;
};

export type ThemeValue = "system" | "dark" | "light";
export type DensityValue = "comfortable" | "compact";
export type LandingPageValue = "overview";

export type AccountPreferencesResponse = {
  persistence: "default" | "stored" | string;
  theme: string;
  density: string;
  landing_page: string;
  reduced_motion: boolean;
  semantics: string;
  updated_at?: string | null;
};

export type AccountPreferencesUpdate = {
  theme?: ThemeValue;
  density?: DensityValue;
  landing_page?: LandingPageValue;
  reduced_motion?: boolean;
};

export type AccountWorkspaceResponse = {
  organization: string;
  department: string | null;
  roles: string[];
  permissions: string[];
  privileged: boolean;
  environment_label: string;
  data_origin: string;
  privileged_roles: string[];
  semantics: string;
};
