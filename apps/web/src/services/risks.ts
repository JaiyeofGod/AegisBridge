import { apiGet } from "@/services/api-client";
import type {
  PageResponse,
  RiskDetailResponse,
  RiskListItem,
  RiskQuery,
} from "@/services/api-types";

export function fetchRisks(query: RiskQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.riskLevel) params.set("risk_level", query.riskLevel);
  if (query.treatmentStatus) params.set("treatment_status", query.treatmentStatus);
  if (query.owner) params.set("owner", query.owner);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<RiskListItem>>(`/api/v1/risks?${params.toString()}`);
}

export function fetchRisk(riskId: string) {
  return apiGet<RiskDetailResponse>(`/api/v1/risks/${encodeURIComponent(riskId)}`);
}
