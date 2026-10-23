import { apiDelete, apiGet, apiPatch, apiPostCsrf } from "@/services/api-client";
import type {
  PageResponse,
  RiskControlLinkResult,
  RiskDetailResponse,
  RiskListItem,
  RiskQuery,
  RiskTreatmentUpdate,
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

export function updateRiskTreatment(riskId: string, patch: RiskTreatmentUpdate) {
  return apiPatch<RiskDetailResponse>(
    `/api/v1/risks/${encodeURIComponent(riskId)}/treatment`,
    patch,
  );
}

/** Link by human ids only. No request body. */
export function linkRiskControl(riskId: string, controlId: string) {
  return apiPostCsrf<RiskControlLinkResult>(
    `/api/v1/risks/${encodeURIComponent(riskId)}/controls/${encodeURIComponent(controlId)}`,
  );
}

/** Unlink relationship only. No request body. */
export function unlinkRiskControl(riskId: string, controlId: string) {
  return apiDelete<RiskControlLinkResult>(
    `/api/v1/risks/${encodeURIComponent(riskId)}/controls/${encodeURIComponent(controlId)}`,
  );
}
