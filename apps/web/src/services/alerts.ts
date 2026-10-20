import { apiGet } from "@/services/api-client";
import type {
  AlertDetailResponse,
  AlertListItem,
  AlertQuery,
  PageResponse,
} from "@/services/api-types";

export function fetchAlerts(query: AlertQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.severity) params.set("severity", query.severity);
  if (query.status) params.set("status", query.status);
  if (query.asset) params.set("asset", query.asset);
  if (query.attackTechnique) params.set("attack_technique", query.attackTechnique);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<AlertListItem>>(`/api/v1/alerts?${params.toString()}`);
}

export function fetchAlert(alertId: string) {
  return apiGet<AlertDetailResponse>(`/api/v1/alerts/${encodeURIComponent(alertId)}`);
}
