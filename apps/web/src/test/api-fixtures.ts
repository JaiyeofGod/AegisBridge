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
  GovernanceSummary,
  IncidentDetailResponse,
  IncidentListItem,
  IndicatorDetailResponse,
  IndicatorListItem,
  IntegrationListItem,
  OverviewResponse,
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
