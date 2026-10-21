import { vi } from "vitest";

import type {
  AccessReviewListItem,
  AdministrationSummary,
  AdminRoleListItem,
  AdminUserListItem,
  AdvisoryListItem,
  AlertDetailResponse,
  AlertListItem,
  AssetDetailResponse,
  AssetListItem,
  AuditEventListItem,
  DatasetDetail,
  DatasetListItem,
  ExperimentDetail,
  ExperimentListItem,
  GovernanceSummary,
  IncidentDetailResponse,
  IncidentListItem,
  IndicatorDetailResponse,
  IndicatorListItem,
  IntegrationListItem,
  OverviewResponse,
  ReportDefinitionDetail,
  ReportDefinitionListItem,
  ReportsSummary,
  RiskDetailResponse,
  RiskListItem,
  ThreatIntelSummary,
  ThreatSourceItem,
  VulnerabilityDetailResponse,
  VulnerabilityListItem,
} from "@/services/api-types";

export function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

export const overviewFixture: OverviewResponse = {
  generated_at: "2026-10-20T12:00:00Z",
  organization_name: "AegisBridge Technologies",
  data_origin: "simulated",
  environment_label: "Lab · Simulated",
  kev_exposure: {
    exposed_asset_count: 1,
    distinct_cve_count: 1,
    asset_ids: ["AST-0007"],
    cve_ids: ["CVE-2024-21887"],
    semantics: "Assets with a known-exploited vulnerability in the development database.",
  },
  open_incidents: 1,
  control_posture: {
    passed: 0,
    assessed_applicable: 1,
    semantics: "Passing assessed applicable controls.",
  },
  telemetry: {
    active: 0,
    expected: 5,
    semantics: "Active telemetry is absent. Wazuh is not connected.",
  },
  my_work: [
    {
      id: "INC-0001",
      kind: "incident",
      title: "Investigate seeded incident",
      status: "open",
      owner: { id: "USR-001", display_name: "Amara Okonkwo" },
    },
  ],
  security_highlights: [
    { id: "hl-1", title: "Seeded exposure", detail: "One known-exploited finding is stored." },
  ],
  executive_notes: [
    { id: "ex-1", title: "Development data", detail: "These notes come from the seeded database." },
  ],
};

const owner = { id: "USR-001", display_name: "Amara Okonkwo" };

export const finAppListItem: AssetListItem = {
  id: "AST-0007",
  hostname: "FIN-APP-01",
  name: "Finance application",
  asset_type: "Linux server",
  asset_type_code: "linux_server",
  criticality: "critical",
  exposure: "internet",
  environment: "simulated",
  telemetry_status: "reference_only",
  lifecycle: "active",
  platform: "Linux",
  last_seen_at: "2026-10-20T12:00:00Z",
  owner,
};

export const workstationListItem: AssetListItem = {
  id: "AST-0018",
  hostname: "WIN-WS-07",
  name: "Analyst workstation",
  asset_type: "Windows endpoint",
  asset_type_code: "windows_endpoint",
  criticality: "high",
  exposure: "internal",
  environment: "simulated",
  telemetry_status: "not_connected",
  lifecycle: "active",
  platform: "Windows",
  last_seen_at: null,
  owner: null,
};

export const assetListItems = [finAppListItem, workstationListItem];

export const finAppDetail: AssetDetailResponse = {
  ...finAppListItem,
  os_version: "Ubuntu 24.04",
  ip_address: "10.0.0.7",
  data_classification: "confidential",
  software: ["nginx"],
  vulnerabilities: [
    {
      id: "VULN-0041",
      title: "CVE-2024-21887",
      status: "open",
      summary: "Stored finding. KEV membership is not a separate field on this record.",
    },
  ],
  alerts: [],
  risks: [{ id: "RISK-0021", title: "Internet exposure", status: "open", summary: null }],
  controls: [
    {
      id: "CTRL-0002",
      title: "Control linked through risk evidence",
      status: "applicable",
      summary: null,
    },
  ],
  evidence: [{ id: "EVID-0041", title: "Finding evidence", status: "collected", summary: null }],
};

export function assetPage<T>(items: T[]) {
  return { page: 1, page_size: 100, total: items.length, items };
}

const priya = { id: "USR-0003", display_name: "Priya Shah" };

export const riskCritical: RiskListItem = {
  id: "RISK-0021",
  title: "Service exploitation on the finance application",
  status: "open",
  methodology: "aegisbridge_likelihood_x_impact",
  methodology_label:
    "AegisBridge internal methodology: score = likelihood × impact. This is not a NIST-mandated formula.",
  likelihood: 4,
  impact: 5,
  score: 20,
  residual_likelihood: null,
  residual_impact: null,
  residual_score: null,
  risk_level: "critical",
  treatment_strategy: "mitigate",
  treatment_status: "planned",
  owner: priya,
  asset_id: "AST-0007",
  asset_hostname: "FIN-APP-01",
};

export const riskLow: RiskListItem = {
  ...riskCritical,
  id: "RISK-0002",
  title: "Low stored risk",
  likelihood: 1,
  impact: 2,
  score: 2,
  risk_level: "low",
  treatment_strategy: "mitigate",
  treatment_status: "planned",
  owner: { id: "USR-0004", display_name: "Jonah Hale" },
  asset_hostname: "EDGE-FW-01",
  asset_id: "AST-0031",
};

export const riskItems = [riskCritical, riskLow];

export const riskDetail: RiskDetailResponse = {
  ...riskCritical,
  statement: "FIN-APP-01 remains exposed with a known critical finding.",
  treatment_notes: "No control change was applied.",
  evidence: [
    {
      id: "EVID-0041",
      title: "Privileged account inventory",
      status: null,
      summary: null,
    },
  ],
  reviews: [],
};

const finAsset = {
  asset_id: "AST-0007",
  hostname: "FIN-APP-01",
  exposure: "internet",
  asset_criticality: "critical",
  status: "open",
  action_decision: "act",
  action_rationale: "CVSS, EPSS, KEV, exposure, and criticality stay in their own columns.",
  action_assessed_at: "2026-10-20T12:00:00Z",
  remediation_status: "open",
  remediation_title: "Patch FIN-APP-01",
  due_on: "2026-10-20",
  owner,
  mitigating_controls: [
    { id: "CTRL-0002", title: "AC-2 Account management", status: null, summary: null },
  ],
};

export const vulnCritical: VulnerabilityListItem = {
  id: "VULN-0041",
  title: "Known-exploited finding on FIN-APP-01",
  cve_id: "CVE-2024-21887",
  cvss_version: "3.1",
  cvss_base_score: 9.8,
  cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  cvss_severity: "critical",
  epss: 0.94,
  epss_percentile: 0.99,
  epss_observed_on: "2026-10-19",
  kev_listed: true,
  kev_date_added: "2024-01-12",
  known_ransomware_use: "unknown",
  assets: [finAsset],
};

export const vulnMedium: VulnerabilityListItem = {
  ...vulnCritical,
  id: "VULN-0099",
  title: "Medium finding without KEV",
  cve_id: "CVE-2024-0001",
  cvss_base_score: 5.3,
  cvss_severity: "medium",
  epss: 0.02,
  kev_listed: false,
  kev_date_added: null,
  assets: [
    {
      ...finAsset,
      asset_id: "AST-0061",
      hostname: "LINUX-APP-01",
      exposure: "internal",
      asset_criticality: "high",
      action_decision: "track",
      remediation_status: "open",
      mitigating_controls: [],
    },
  ],
};

export const vulnItems = [vulnCritical, vulnMedium];

export const vulnDetail: VulnerabilityDetailResponse = {
  ...vulnCritical,
  cve_summary: "Stored catalog summary. Not a live NVD fetch.",
};

export const alertHigh: AlertListItem = {
  id: "AL-0107",
  severity: "high",
  status: "new",
  summary: "Simulated selected metadata. No raw Wazuh event is stored.",
  observed_at: "2026-10-20T12:00:00Z",
  telemetry_source: "not_connected",
  wazuh_alert_id: null,
  source_of_record: "wazuh",
  stored_scope: "selected_metadata",
  asset_id: "AST-0018",
  asset_hostname: "WIN-WS-07",
  detection_id: "DET-0005",
  detection_name: "Suspicious PowerShell child process",
  attack_technique_id: "T1059.001",
  attack_technique_name: "PowerShell",
  attack_tactic: "Execution",
  investigation_id: "INV-0012",
  assignee: { id: "USR-0004", display_name: "Jonah Hale" },
};

export const alertLow: AlertListItem = {
  id: "AL-0199",
  severity: "low",
  status: "closed",
  summary: "Second development alert used to prove filters.",
  observed_at: "2026-10-20T11:00:00Z",
  telemetry_source: "not_connected",
  wazuh_alert_id: null,
  source_of_record: "wazuh",
  stored_scope: "selected_metadata",
  asset_id: "AST-0099",
  asset_hostname: "LAB-WS-99",
  detection_id: "DET-0099",
  detection_name: "Benign process start",
  attack_technique_id: "T1110",
  attack_technique_name: "Brute Force",
  attack_tactic: "Credential Access",
  investigation_id: null,
  assignee: { id: "USR-0009", display_name: "Casey Quinn" },
};

export const alertItems = [alertHigh, alertLow];

export const alertDetail: AlertDetailResponse = {
  ...alertHigh,
  detection_status: "simulated",
  detection_version: "1",
  detection_logic_summary: "Reference rule summary only. Not deployed to Wazuh.",
  attack_version: "Enterprise v20.0",
  investigation_status: "open",
  investigation_summary: "Simulated investigation. No confirmed compromise.",
};

export const incidentPrimary: IncidentListItem = {
  id: "INC-0001",
  title: "Repeated authentication failures",
  severity: "medium",
  status: "investigating",
  containment_state: null,
  summary: "Simulated incident. Severity and status are separate. No confirmed compromise.",
  owner: { id: "USR-0004", display_name: "Jonah Hale" },
  open_task_count: 0,
  evidence_count: 1,
};

export const incidentOther: IncidentListItem = {
  id: "INC-0099",
  title: "Low severity development incident",
  severity: "low",
  status: "new",
  containment_state: null,
  summary: "Second development incident used to prove filters.",
  owner: { id: "USR-0009", display_name: "Casey Quinn" },
  open_task_count: 0,
  evidence_count: 0,
};

export const incidentItems = [incidentPrimary, incidentOther];

export const incidentDetail: IncidentDetailResponse = {
  ...incidentPrimary,
  timeline: [
    {
      occurred_at: "2026-10-20T12:00:00Z",
      summary: "Opened from simulated authentication failures.",
    },
  ],
  tasks: [],
  indicators: [],
  evidence: [
    {
      id: "EVID-0041",
      title: "Privileged account inventory",
      sha256: "fixture-sha256",
      collected_at: "2026-10-20T12:05:00Z",
      note: "Reference only.",
    },
  ],
  related_alerts: [],
  affected_assets: [],
};

export const emptyIncidentDetail: IncidentDetailResponse = {
  ...incidentPrimary,
  evidence_count: 0,
  timeline: [],
  tasks: [],
  indicators: [],
  evidence: [],
  related_alerts: [],
  affected_assets: [],
};

export const governanceSummary: GovernanceSummary = {
  frameworks: [
    {
      code: "NIST-800-53",
      name: "NIST SP 800-53",
      version: "Rev. 5",
      control_count: 1,
      licensed_text_included: false,
    },
  ],
  control_implementations: {
    by_status: { partial: 1 },
    tests_passed: 0,
    tests_recorded: 0,
    assessed_applicable: 1,
  },
  evidence_freshness: {
    recorded: 1,
    with_sha256: 1,
    missing_collected_at: 0,
    semantics:
      "Freshness is collected_at plus SHA-256 presence. No evidence due date is stored, and file bytes are not returned.",
  },
  assessment_work: { tests_recorded: 0, items: [] },
  policies: [
    {
      id: "POL-0001",
      title: "Access control policy",
      status: "draft",
      current_version: "0.1",
      acknowledgement_count: 1,
      owner: { id: "USR-0003", display_name: "Priya Shah" },
    },
  ],
  access_reviews: [
    {
      id: "ARV-0001",
      name: "October access review",
      status: "in_progress",
      open_findings: 1,
      total_findings: 1,
    },
  ],
};

export const emptyGovernanceSummary: GovernanceSummary = {
  frameworks: [],
  control_implementations: {
    by_status: {},
    tests_passed: 0,
    tests_recorded: 0,
    assessed_applicable: 0,
  },
  evidence_freshness: {
    recorded: 0,
    with_sha256: 0,
    missing_collected_at: 0,
    semantics: "No evidence metadata is stored.",
  },
  assessment_work: { tests_recorded: 0, items: [] },
  policies: [],
  access_reviews: [],
};

const internalSource = {
  id: "SRC-0006",
  name: "Internal simulated set",
  connection_status: "reference_only",
};

export const threatIntelSummary: ThreatIntelSummary = {
  active_indicator_count: 2,
  internal_match_count: 1,
  advisory_count: 1,
  source_health: { reference_only: 2, not_connected: 4 },
  data_origin: "simulated",
  semantics:
    "Counts are stored development records. reference_only and not_connected mean the named feed is not connected. Reserved example addresses are simulated indicators, not live threat intelligence.",
};

export const emptyThreatIntelSummary: ThreatIntelSummary = {
  active_indicator_count: 0,
  internal_match_count: 0,
  advisory_count: 0,
  source_health: {},
  data_origin: "simulated",
  semantics: "No threat-intelligence rows are stored.",
};

export const indicatorItems: IndicatorListItem[] = [
  {
    id: "IOC-0001",
    indicator_type: "ip",
    value: "203.0.113.50",
    confidence: "low",
    severity: "low",
    source: internalSource,
    first_seen: "2026-10-19T21:12:00Z",
    last_seen: "2026-10-19T21:12:00Z",
    status: "active",
    internal_match: false,
    attack_technique_id: null,
    matched_asset_id: null,
  },
  {
    id: "IOC-0002",
    indicator_type: "domain",
    value: "dev-watch.example",
    confidence: "medium",
    severity: "medium",
    source: internalSource,
    first_seen: "2026-10-19T21:12:00Z",
    last_seen: "2026-10-19T21:12:00Z",
    status: "active",
    internal_match: true,
    attack_technique_id: "T1059.001",
    matched_asset_id: "AST-0007",
  },
  {
    id: "IOC-0003",
    indicator_type: "file_hash",
    value: "83819ede6bb30a3d75f82ffea90ccb8e3e9603347985f706c55cac517ae5f69a",
    confidence: "low",
    severity: null,
    source: internalSource,
    first_seen: "2026-10-19T21:12:00Z",
    last_seen: "2026-10-19T21:12:00Z",
    status: "expired",
    internal_match: false,
    attack_technique_id: null,
    matched_asset_id: null,
  },
];

export function indicatorDetail(id: string): IndicatorDetailResponse {
  const row = indicatorItems.find((item) => item.id === id) ?? indicatorItems[0];
  return {
    ...row,
    summary:
      row.id === "IOC-0002"
        ? "Stored simulated internal-match label for AST-0007 and ATT&CK T1059.001. Not a live correlation and not a confirmed compromise."
        : "Simulated development indicator. External feeds were not queried.",
    attack:
      row.id === "IOC-0002"
        ? { technique_id: "T1059.001", name: "PowerShell", tactic: "Execution" }
        : null,
    matched_asset:
      row.id === "IOC-0002"
        ? {
            id: "AST-0007",
            title: "FIN-APP-01",
            status: null,
            summary: "Simulated internal-match label. Not a confirmed compromise.",
          }
        : null,
    data_origin: "simulated",
  };
}

export function filteredIndicators(url: string) {
  const params = new URL(url, "http://localhost").searchParams;
  let items = indicatorItems;
  const type = params.get("indicator_type");
  const status = params.get("status");
  const source = params.get("source");
  const search = params.get("search")?.toLowerCase();
  const match = params.get("internal_match");
  if (type) items = items.filter((item) => item.indicator_type === type);
  if (status) items = items.filter((item) => item.status === status);
  if (source) {
    const token = source.toLowerCase();
    items = items.filter(
      (item) => item.source.id.toLowerCase() === token || item.source.name.toLowerCase() === token,
    );
  }
  if (search) {
    items = items.filter(
      (item) => item.value.toLowerCase().includes(search) || item.id.toLowerCase().includes(search),
    );
  }
  if (match === "true") items = items.filter((item) => item.internal_match);
  if (match === "false") items = items.filter((item) => !item.internal_match);
  return assetPage(items);
}

export const advisoryItems: AdvisoryListItem[] = [
  {
    id: "ADV-0001",
    title: "Simulated development advisory",
    summary:
      "Stored metadata naming CVE-2024-21887. NVD was not queried and this is not a live advisory.",
    status: "reference",
    confidence: "low",
    related_cve: "CVE-2024-21887",
    published_at: "2026-10-19T21:12:00Z",
    source: internalSource,
  },
];

export const threatSources: ThreatSourceItem[] = [
  {
    id: "SRC-0001",
    name: "CISA KEV",
    provider: "cisa",
    purpose: "Known exploited vulnerabilities catalog name.",
    connection_status: "reference_only",
    notes: "Catalog name only. The KEV feed is not connected.",
  },
  {
    id: "SRC-0002",
    name: "NVD",
    provider: "nvd",
    purpose: "National Vulnerability Database catalog name.",
    connection_status: "not_connected",
    notes: "Catalog name only. The NVD feed is not connected.",
  },
  {
    id: "SRC-0003",
    name: "EPSS",
    provider: "first",
    purpose: "Exploit prediction score catalog name.",
    connection_status: "not_connected",
    notes: "Catalog name only. The EPSS feed is not connected.",
  },
  {
    id: "SRC-0004",
    name: "ThreatFox",
    provider: "abuse.ch",
    purpose: "Indicator catalog name.",
    connection_status: "not_connected",
    notes: "Catalog name only. The ThreatFox feed is not connected.",
  },
  {
    id: "SRC-0005",
    name: "URLhaus",
    provider: "abuse.ch",
    purpose: "Malicious URL catalog name.",
    connection_status: "not_connected",
    notes: "Catalog name only. The URLhaus feed is not connected.",
  },
  {
    id: "SRC-0006",
    name: "Internal simulated set",
    provider: "internal",
    purpose: "Development indicators stored in PostgreSQL.",
    connection_status: "reference_only",
    notes: "Development indicators stored in PostgreSQL. Not a live feed.",
  },
];

export const administrationSummary: AdministrationSummary = {
  configured_integration_count: 0,
  integration_status: { not_configured: 1, reference_only: 1 },
  integration_freshness: { not_connected: 2 },
  active_user_count: 5,
  privileged_user_count: 2,
  recent_audit_event_count: 2,
  pending_access_review_count: 1,
  privileged_roles: ["Administrator", "Security Engineer"],
  semantics:
    "Privileged users are those assigned Administrator or Security Engineer. configured counts only integrations whose stored status is configured. not_connected freshness means the connector is absent. Credentials are not stored.",
};

export const emptyAdministrationSummary: AdministrationSummary = {
  configured_integration_count: 0,
  integration_status: {},
  integration_freshness: {},
  active_user_count: 0,
  privileged_user_count: 0,
  recent_audit_event_count: 0,
  pending_access_review_count: 0,
  privileged_roles: [],
  semantics: "No administration rows are stored. Credentials are not stored.",
};

export const integrationItems: IntegrationListItem[] = [
  {
    id: "INT-0001",
    name: "Wazuh",
    provider: "siem",
    status: "not_configured",
    freshness: "not_connected",
    last_sync_at: null,
    last_success_at: null,
    credential_state: "No credentials stored",
    notes: "Wazuh remains the system of record. This row is a catalog reference.",
  },
  {
    id: "INT-0002",
    name: "Example identity provider",
    provider: "identity",
    status: "reference_only",
    freshness: "not_connected",
    last_sync_at: null,
    last_success_at: null,
    credential_state: "No credentials stored",
    notes:
      "Catalog reference only. The identity provider is not connected and no credentials are stored.",
  },
];

export const adminUsers: AdminUserListItem[] = [
  {
    id: "USR-0001",
    display_name: "Amara Okonkwo",
    email: "amara.okonkwo@aegisbridge.example",
    status: "active",
    department: "Security",
    roles: ["Administrator"],
    privileged: true,
  },
  {
    id: "USR-0002",
    display_name: "Nia Okeke",
    email: "nia.okeke@aegisbridge.example",
    status: "active",
    department: "Security",
    roles: ["Security Engineer"],
    privileged: true,
  },
  {
    id: "USR-0004",
    display_name: "Jonah Hale",
    email: "jonah.hale@aegisbridge.example",
    status: "active",
    department: "Security",
    roles: ["SOC Analyst"],
    privileged: false,
  },
];

export const adminRoles: AdminRoleListItem[] = [
  {
    id: "Administrator",
    name: "Administrator",
    summary: "Platform configuration, users, roles, and integrations.",
    permissions: ["integration.manage", "user.role.manage"],
  },
  {
    id: "Auditor",
    name: "Auditor",
    summary: "Reads evidence and audit history.",
    permissions: ["evidence.download"],
  },
  {
    id: "CISO",
    name: "CISO",
    summary: "Reads executive posture, risks, and major incidents.",
    permissions: [],
  },
  {
    id: "GRC Analyst",
    name: "GRC Analyst",
    summary: "Works risks, controls, and evidence.",
    permissions: ["risk.accept", "control.update", "evidence.download"],
  },
  {
    id: "Read Only",
    name: "Read Only",
    summary: "Reads records without write labels.",
    permissions: [],
  },
  {
    id: "SOC Analyst",
    name: "SOC Analyst",
    summary: "Triages alerts and incident tasks.",
    permissions: ["incident.close"],
  },
  {
    id: "Security Engineer",
    name: "Security Engineer",
    summary: "Manages detections, integrations, and technical evidence.",
    permissions: ["detection.manage", "integration.manage"],
  },
];

export const auditEvents: AuditEventListItem[] = [
  {
    id: "AUD-0002",
    occurred_at: "2026-10-19T21:13:00Z",
    actor: { id: "USR-0001", display_name: "Amara Okonkwo" },
    actor_label: "USR-0001",
    action: "Recorded Security Engineer catalog role",
    object_type: "role",
    object_id: "Security Engineer",
    result: "simulated",
    source: "seed",
    environment_name: "local",
    detail: "Role catalog alignment with master requirements. No secret material.",
  },
  {
    id: "AUD-0001",
    occurred_at: "2026-10-19T21:12:00Z",
    actor: { id: "USR-0001", display_name: "Amara Okonkwo" },
    actor_label: "USR-0001",
    action: "Recorded development seed",
    object_type: "organization",
    object_id: "aegisbridge-technologies",
    result: "simulated",
    source: "seed",
    environment_name: "local",
    detail: "Synthetic development records. No secret material.",
  },
];

export const accessReviewItems: AccessReviewListItem[] = [
  {
    id: "ARV-0001",
    name: "October access review",
    status: "in_progress",
    owner: null,
    open_finding_count: 1,
    total_finding_count: 1,
    due_at: null,
  },
];

export const reportsSummary: ReportsSummary = {
  report_definition_count: 5,
  scheduled_report_count: 3,
  completed_report_count: 0,
  failed_report_count: 0,
  recent_execution_count: 0,
  dataset_count: 9,
  dataset_quality_review_count: 2,
  experiment_count: 4,
  semantics:
    "Report definitions are stored catalog rows. schedule_defined means a cadence label is stored; no report scheduler or worker is running. completed_report_count, failed_report_count, and recent_execution_count stay at zero because no report execution or export rows are stored. Datasets are registry metadata only unless files are stored.",
};

export const emptyReportsSummary: ReportsSummary = {
  report_definition_count: 0,
  scheduled_report_count: 0,
  completed_report_count: 0,
  failed_report_count: 0,
  recent_execution_count: 0,
  dataset_count: 0,
  dataset_quality_review_count: 0,
  experiment_count: 0,
  semantics: "No report, dataset, or experiment rows are stored.",
};

const reportOwner = { id: "USR-0001", display_name: "Amara Okonkwo" };
const reportOwnerGrc = { id: "USR-0003", display_name: "Grace Mensah" };

export const reportDefinitions: ReportDefinitionListItem[] = [
  {
    id: "RPT-0001",
    name: "Executive Security Summary",
    description: "Stored definition for an executive posture summary. No PDF is generated.",
    report_type: "executive_security_summary",
    status: "ready",
    schedule_state: "schedule_defined",
    schedule_label: "Weekly",
    format_label: "PDF",
    owner: reportOwner,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    last_run_at: null,
    next_run_at: null,
  },
  {
    id: "RPT-0002",
    name: "Vulnerability Exposure Report",
    description: "Stored definition for vulnerability exposure columns. No CSV is generated.",
    report_type: "vulnerability_exposure",
    status: "ready",
    schedule_state: "schedule_defined",
    schedule_label: "Weekly",
    format_label: "CSV",
    owner: reportOwner,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    last_run_at: null,
    next_run_at: null,
  },
  {
    id: "RPT-0003",
    name: "Risk Register Report",
    description: "Stored definition for the risk register. No export file is generated.",
    report_type: "risk_register",
    status: "ready",
    schedule_state: "not_scheduled",
    schedule_label: null,
    format_label: "PDF",
    owner: reportOwnerGrc,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    last_run_at: null,
    next_run_at: null,
  },
  {
    id: "RPT-0004",
    name: "Control Assessment Report",
    description:
      "Stored definition for control assessment summaries. CIS licensed text is omitted.",
    report_type: "control_assessment",
    status: "ready",
    schedule_state: "schedule_defined",
    schedule_label: "Monthly",
    format_label: "PDF",
    owner: reportOwnerGrc,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    last_run_at: null,
    next_run_at: null,
  },
  {
    id: "RPT-0005",
    name: "Incident Summary Report",
    description: "Stored definition for incident summaries. No compromise verdict is invented.",
    report_type: "incident_summary",
    status: "review",
    schedule_state: "not_scheduled",
    schedule_label: null,
    format_label: "PDF",
    owner: reportOwner,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    last_run_at: null,
    next_run_at: null,
  },
];

export function reportDefinitionDetail(id: string): ReportDefinitionDetail {
  const item = reportDefinitions.find((row) => row.id === id) ?? reportDefinitions[0];
  return { ...item, generated_files: [] };
}

export function filteredReportDefinitions(url: string) {
  let items = [...reportDefinitions];
  const params = new URL(url, "http://localhost").searchParams;
  const search = params.get("search")?.toLowerCase();
  const status = params.get("status");
  const reportType = params.get("report_type");
  if (search) {
    items = items.filter((item) =>
      `${item.id} ${item.name} ${item.description} ${item.report_type}`
        .toLowerCase()
        .includes(search),
    );
  }
  if (status) items = items.filter((item) => item.status === status);
  if (reportType) items = items.filter((item) => item.report_type === reportType);
  return assetPage(items);
}

export const datasetItems: DatasetListItem[] = [
  {
    id: "DS-0001",
    name: "Smishing Dataset – IMC25",
    description: "Registry entry for the IMC25 smishing dataset. No file is stored.",
    publisher: "IMC25 project",
    source_label: "Publisher catalog",
    source_url: null,
    publication_year: 2025,
    domain: "Smishing and social engineering",
    license_label: "CC BY 4.0",
    status: "not_downloaded",
    verification_status: "reviewed",
    purpose: "Message analytics and explainable reporting",
    size_label: "Lightweight labeled CSV",
    row_count: null,
    feature_count: null,
    file_count: 0,
    version_count: 1,
    experiment_count: 1,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    notes: "Name and license label only. The dataset file is not downloaded.",
  },
  {
    id: "DS-0002",
    name: "CICAPT-IIoT2024 subset",
    description: "Registry entry for a selected CICAPT-IIoT2024 subset. No subset file is stored.",
    publisher: "Canadian Institute for Cybersecurity",
    source_label: "Publisher catalog",
    source_url: null,
    publication_year: 2024,
    domain: "IIoT APT detection",
    license_label: "Publisher terms",
    status: "not_downloaded",
    verification_status: "reviewed",
    purpose: "Provenance and ATT&CK-relevant detection research",
    size_label: "Selected subset only",
    row_count: null,
    feature_count: null,
    file_count: 0,
    version_count: 1,
    experiment_count: 1,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    notes: "Registry metadata only. The subset is not in the repository.",
  },
  {
    id: "DS-0003",
    name: "CICIoT2023",
    description: "Optional IoT network-attack registry entry. No capture file is stored.",
    publisher: "Canadian Institute for Cybersecurity",
    source_label: "Publisher catalog",
    source_url: null,
    publication_year: 2023,
    domain: "IoT network attacks",
    license_label: "Publisher terms",
    status: "not_downloaded",
    verification_status: "not_reviewed",
    purpose: "IDS analytics experiments",
    size_label: "Large · subset only",
    row_count: null,
    feature_count: null,
    file_count: 0,
    version_count: 1,
    experiment_count: 0,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    notes: "Registry metadata only. Full capture is not downloaded.",
  },
  {
    id: "DS-0004",
    name: "DataSense CIC IIoT 2025",
    description: "Optional multi-modal IIoT registry entry. No file is stored.",
    publisher: "Canadian Institute for Cybersecurity",
    source_label: "Publisher catalog",
    source_url: null,
    publication_year: 2025,
    domain: "IIoT sensor and network",
    license_label: "Publisher terms",
    status: "not_downloaded",
    verification_status: "not_reviewed",
    purpose: "Multi-modal anomaly research",
    size_label: "Large · not downloaded",
    row_count: null,
    feature_count: null,
    file_count: 0,
    version_count: 1,
    experiment_count: 0,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    notes: "Do not download the full dataset during initial development.",
  },
  {
    id: "DS-0005",
    name: "CIC-Trap4Phish 2025",
    description: "Optional phishing document and URL registry entry. Attachments are not executed.",
    publisher: "Canadian Institute for Cybersecurity",
    source_label: "Publisher catalog",
    source_url: null,
    publication_year: 2025,
    domain: "Phishing documents and URLs",
    license_label: "Publisher terms",
    status: "not_downloaded",
    verification_status: "not_reviewed",
    purpose: "Safe static features. Attachments are not executed.",
    size_label: "Static feature subset",
    row_count: null,
    feature_count: null,
    file_count: 0,
    version_count: 1,
    experiment_count: 1,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    notes: "Registry metadata only. No attachment bytes are stored.",
  },
  {
    id: "DS-0006",
    name: "PhreshPhish",
    description: "Optional large-scale phishing registry entry. No sample file is stored.",
    publisher: "PhreshPhish project",
    source_label: "Publisher catalog",
    source_url: null,
    publication_year: 2025,
    domain: "Large-scale phishing",
    license_label: "CC BY 4.0",
    status: "not_downloaded",
    verification_status: "verification_required",
    purpose: "Sampled phishing research",
    size_label: "About 36.6 GB · sample only",
    row_count: null,
    feature_count: null,
    file_count: 0,
    version_count: 1,
    experiment_count: 0,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    notes: "Size label is from published notes. No download and no verification run.",
  },
  {
    id: "DS-0007",
    name: "CIC-PQC_OAV v1",
    description: "Optional post-quantum TLS registry entry. No session file is stored.",
    publisher: "Canadian Institute for Cybersecurity",
    source_label: "Publisher catalog",
    source_url: null,
    publication_year: 2025,
    domain: "TLS and post-quantum operations",
    license_label: "Publisher terms",
    status: "not_downloaded",
    verification_status: "not_reviewed",
    purpose: "Later protocol research",
    size_label: "About 40,010 sessions",
    row_count: null,
    feature_count: null,
    file_count: 0,
    version_count: 1,
    experiment_count: 0,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    notes: "Session count is a published label. No file is stored.",
  },
  {
    id: "DS-0008",
    name: "CIC-YNU-IoTMal 2026",
    description: "Optional IoT malware behavior registry entry. Raw binaries are not a dependency.",
    publisher: "Canadian Institute for Cybersecurity",
    source_label: "Publisher catalog",
    source_url: null,
    publication_year: 2026,
    domain: "IoT malware behavior",
    license_label: "Publisher terms",
    status: "not_downloaded",
    verification_status: "verification_required",
    purpose: "Derived behavior research. Raw binaries are not a dependency.",
    size_label: "Processed features only",
    row_count: null,
    feature_count: null,
    file_count: 0,
    version_count: 1,
    experiment_count: 0,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    notes: "Registry metadata only. No malware binary is stored.",
  },
  {
    id: "DS-0009",
    name: "AegisBridge internal telemetry",
    description: "Local cyber-range telemetry placeholder. The lab host is not connected.",
    publisher: "AegisBridge Technologies",
    source_label: "Project-owned",
    source_url: null,
    publication_year: 2026,
    domain: "Lab endpoint and network telemetry",
    license_label: "Project-owned",
    status: "not_downloaded",
    verification_status: "reviewed",
    purpose: "Local validation records. Kept apart from published datasets.",
    size_label: "Not collected",
    row_count: null,
    feature_count: null,
    file_count: 0,
    version_count: 1,
    experiment_count: 1,
    created_at: "2026-10-19T20:00:00Z",
    updated_at: "2026-10-19T20:00:00Z",
    notes: "No telemetry file is stored. The lab host is not connected.",
  },
];

export function datasetDetail(id: string): DatasetDetail {
  const item = datasetItems.find((row) => row.id === id) ?? datasetItems[0];
  return {
    ...item,
    versions: [
      {
        version_label: "registry",
        file_count: 0,
        experiment_count: item.experiment_count,
        created_at: "2026-10-19T20:00:00Z",
      },
    ],
    files: [],
    experiments: experimentItems
      .filter((experiment) => experiment.dataset.id === item.id)
      .map((experiment) => ({
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        experiment_type: experiment.experiment_type,
      })),
  };
}

export function filteredDatasets(url: string) {
  let items = [...datasetItems];
  const params = new URL(url, "http://localhost").searchParams;
  const search = params.get("search")?.toLowerCase();
  const status = params.get("status");
  const domain = params.get("domain");
  const verification = params.get("verification_status");
  const year = params.get("publication_year");
  if (search) {
    items = items.filter((item) =>
      `${item.id} ${item.name} ${item.publisher ?? ""} ${item.domain ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }
  if (status) items = items.filter((item) => item.status === status);
  if (domain) items = items.filter((item) => item.domain === domain);
  if (verification) items = items.filter((item) => item.verification_status === verification);
  if (year) items = items.filter((item) => String(item.publication_year) === year);
  return assetPage(items);
}

export const experimentItems: ExperimentListItem[] = [
  {
    id: "RSCH-0001",
    name: "Smishing lure categories",
    status: "completed",
    experiment_type: "classification_summary",
    approach: "Manual category tabulation",
    metrics_summary:
      "Category counts were tabulated from the registry note. No model runtime was used.",
    started_at: "2026-10-19T20:00:00Z",
    completed_at: "2026-10-19T20:00:00Z",
    notes: "Completed metadata only. No model artifact is stored.",
    dataset: {
      id: "DS-0001",
      title: "Smishing Dataset – IMC25",
      status: "not_downloaded",
      summary: null,
    },
  },
  {
    id: "RSCH-0002",
    name: "IIoT subset provenance check",
    status: "completed",
    experiment_type: "manifest_review",
    approach: "Manifest field review",
    metrics_summary: "Manifest fields are recorded. The subset is not in the repository.",
    started_at: "2026-10-19T20:00:00Z",
    completed_at: "2026-10-19T20:00:00Z",
    notes: "Completed metadata only. No detection comparison was run.",
    dataset: {
      id: "DS-0002",
      title: "CICAPT-IIoT2024 subset",
      status: "not_downloaded",
      summary: null,
    },
  },
  {
    id: "RSCH-0003",
    name: "Range telemetry freshness",
    status: "completed",
    experiment_type: "telemetry_review",
    approach: "Simulated validation comparison",
    metrics_summary: "Three simulated runs are on record. The lab host is not connected.",
    started_at: "2026-10-19T20:00:00Z",
    completed_at: "2026-10-19T20:00:00Z",
    notes: "Completed metadata only. No live range connection exists.",
    dataset: {
      id: "DS-0009",
      title: "AegisBridge internal telemetry",
      status: "not_downloaded",
      summary: null,
    },
  },
  {
    id: "RSCH-0004",
    name: "Static phishing features",
    status: "planned",
    experiment_type: "static_feature_review",
    approach: "Static-feature plan",
    metrics_summary: null,
    started_at: null,
    completed_at: null,
    notes: "Not started. No download and no execution.",
    dataset: {
      id: "DS-0005",
      title: "CIC-Trap4Phish 2025",
      status: "not_downloaded",
      summary: null,
    },
  },
];

export function experimentDetail(id: string): ExperimentDetail {
  const item = experimentItems.find((row) => row.id === id) ?? experimentItems[0];
  return { ...item, dataset_version_label: "registry" };
}

export function filteredExperiments(url: string) {
  let items = [...experimentItems];
  const params = new URL(url, "http://localhost").searchParams;
  const search = params.get("search")?.toLowerCase();
  const status = params.get("status");
  const datasetId = params.get("dataset_id");
  const experimentType = params.get("experiment_type");
  if (search) {
    items = items.filter((item) =>
      `${item.id} ${item.name} ${item.approach ?? ""} ${item.dataset.id}`
        .toLowerCase()
        .includes(search),
    );
  }
  if (status) items = items.filter((item) => item.status === status);
  if (datasetId) items = items.filter((item) => item.dataset.id === datasetId);
  if (experimentType) items = items.filter((item) => item.experiment_type === experimentType);
  return assetPage(items);
}

export function installApiFetch(resolve?: (url: string) => unknown) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (resolve) return resolve(url);
    if (url.includes("/api/v1/health")) {
      return jsonResponse({ status: "ok", service: "aegisbridge" });
    }
    if (url.includes("/api/v1/overview")) return jsonResponse(overviewFixture);
    if (/\/api\/v1\/assets\/[^?]+/.test(url)) return jsonResponse(finAppDetail);
    if (url.includes("/api/v1/assets")) {
      if (url.includes("criticality=critical")) return jsonResponse(assetPage([finAppListItem]));
      return jsonResponse(assetPage(assetListItems));
    }
    if (/\/api\/v1\/risks\/[^?]+/.test(url)) return jsonResponse(riskDetail);
    if (url.includes("/api/v1/risks")) {
      if (url.includes("risk_level=critical")) return jsonResponse(assetPage([riskCritical]));
      return jsonResponse(assetPage(riskItems));
    }
    if (/\/api\/v1\/vulnerabilities\/[^?]+/.test(url)) return jsonResponse(vulnDetail);
    if (url.includes("/api/v1/vulnerabilities")) {
      if (url.includes("severity=critical")) return jsonResponse(assetPage([vulnCritical]));
      return jsonResponse(assetPage(vulnItems));
    }
    if (/\/api\/v1\/alerts\/[^?]+/.test(url)) return jsonResponse(alertDetail);
    if (url.includes("/api/v1/alerts")) {
      if (
        url.includes("severity=high") ||
        url.includes("attack_technique=T1059.001") ||
        url.includes("asset=WIN-WS-07")
      ) {
        return jsonResponse(assetPage([alertHigh]));
      }
      return jsonResponse(assetPage(alertItems));
    }
    if (/\/api\/v1\/incidents\/[^?]+/.test(url)) return jsonResponse(incidentDetail);
    if (url.includes("/api/v1/governance/summary")) return jsonResponse(governanceSummary);
    if (/\/api\/v1\/threat-intelligence\/indicators\/[^/?]+/.test(url)) {
      const id = url.split("/indicators/")[1]?.split("?")[0] ?? "";
      return jsonResponse(indicatorDetail(decodeURIComponent(id)));
    }
    if (url.includes("/api/v1/threat-intelligence/summary")) {
      return jsonResponse(threatIntelSummary);
    }
    if (url.includes("/api/v1/threat-intelligence/indicators")) {
      return jsonResponse(filteredIndicators(url));
    }
    if (url.includes("/api/v1/threat-intelligence/advisories")) {
      return jsonResponse(assetPage(advisoryItems));
    }
    if (url.includes("/api/v1/threat-intelligence/sources")) {
      return jsonResponse(assetPage(threatSources));
    }
    if (url.includes("/api/v1/administration/summary")) return jsonResponse(administrationSummary);
    if (url.includes("/api/v1/administration/integrations")) {
      return jsonResponse(assetPage(integrationItems));
    }
    if (url.includes("/api/v1/administration/users")) return jsonResponse(assetPage(adminUsers));
    if (url.includes("/api/v1/administration/roles")) return jsonResponse(assetPage(adminRoles));
    if (url.includes("/api/v1/administration/audit-events")) {
      return jsonResponse(assetPage(auditEvents));
    }
    if (url.includes("/api/v1/administration/access-reviews")) {
      return jsonResponse(assetPage(accessReviewItems));
    }
    if (url.includes("/api/v1/reports/summary")) return jsonResponse(reportsSummary);
    if (/\/api\/v1\/reports\/definitions\/[^/?]+/.test(url)) {
      const id = url.split("/definitions/")[1]?.split("?")[0] ?? "";
      return jsonResponse(reportDefinitionDetail(decodeURIComponent(id)));
    }
    if (url.includes("/api/v1/reports/definitions")) {
      return jsonResponse(filteredReportDefinitions(url));
    }
    if (/\/api\/v1\/datasets\/[^/?]+/.test(url)) {
      const id = url.split("/datasets/")[1]?.split("?")[0] ?? "";
      return jsonResponse(datasetDetail(decodeURIComponent(id)));
    }
    if (url.includes("/api/v1/datasets")) return jsonResponse(filteredDatasets(url));
    if (/\/api\/v1\/dataset-experiments\/[^/?]+/.test(url)) {
      const id = url.split("/dataset-experiments/")[1]?.split("?")[0] ?? "";
      return jsonResponse(experimentDetail(decodeURIComponent(id)));
    }
    if (url.includes("/api/v1/dataset-experiments")) {
      return jsonResponse(filteredExperiments(url));
    }
    if (url.includes("/api/v1/incidents")) {
      if (url.includes("containment_state=")) return jsonResponse(assetPage([]));
      if (url.includes("severity=medium") || url.includes("owner=Jonah")) {
        return jsonResponse(assetPage([incidentPrimary]));
      }
      return jsonResponse(assetPage(incidentItems));
    }
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}
