import { vi } from "vitest";

import type {
  AlertDetailResponse,
  AlertListItem,
  AssetDetailResponse,
  AssetListItem,
  IncidentDetailResponse,
  IncidentListItem,
  OverviewResponse,
  RiskDetailResponse,
  RiskListItem,
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
