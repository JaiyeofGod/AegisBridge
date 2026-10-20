import { apiGet } from "@/services/api-client";
import type {
  PageResponse,
  VulnerabilityDetailResponse,
  VulnerabilityListItem,
  VulnerabilityQuery,
} from "@/services/api-types";

export function fetchVulnerabilities(query: VulnerabilityQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.severity) params.set("severity", query.severity);
  if (query.kev !== undefined) params.set("kev", String(query.kev));
  if (query.actionDecision) params.set("action_decision", query.actionDecision);
  if (query.remediationStatus) params.set("remediation_status", query.remediationStatus);
  if (query.assetCriticality) params.set("asset_criticality", query.assetCriticality);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<VulnerabilityListItem>>(
    `/api/v1/vulnerabilities?${params.toString()}`,
  );
}

export function fetchVulnerability(vulnerabilityId: string) {
  return apiGet<VulnerabilityDetailResponse>(
    `/api/v1/vulnerabilities/${encodeURIComponent(vulnerabilityId)}`,
  );
}
