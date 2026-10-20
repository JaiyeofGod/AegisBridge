import { vi } from "vitest";

import type { AssetDetailResponse, AssetListItem, OverviewResponse } from "@/services/api-types";

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

export function assetPage(items: AssetListItem[]) {
  return { page: 1, page_size: 100, total: items.length, items };
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
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}
