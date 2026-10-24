import { apiGet } from "@/services/api-client";
import type {
  AdvisoryListItem,
  IndicatorDetailResponse,
  IndicatorListItem,
  IndicatorQuery,
  PageResponse,
  ThreatIntelSummary,
  ThreatSourceItem,
} from "@/services/api-types";

export function fetchThreatIntelSummary() {
  return apiGet<ThreatIntelSummary>("/api/v1/threat-intelligence/summary");
}

export function fetchIndicators(query: IndicatorQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.indicatorType) params.set("indicator_type", query.indicatorType);
  if (query.source) params.set("source", query.source);
  if (query.status) params.set("status", query.status);
  if (query.internalMatch !== undefined) {
    params.set("internal_match", query.internalMatch ? "true" : "false");
  }
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 25));
  return apiGet<PageResponse<IndicatorListItem>>(
    `/api/v1/threat-intelligence/indicators?${params.toString()}`,
  );
}

export function fetchIndicator(indicatorId: string) {
  return apiGet<IndicatorDetailResponse>(
    `/api/v1/threat-intelligence/indicators/${encodeURIComponent(indicatorId)}`,
  );
}

export function fetchAdvisories() {
  return apiGet<PageResponse<AdvisoryListItem>>(
    "/api/v1/threat-intelligence/advisories?page=1&page_size=100",
  );
}

export function fetchThreatSources() {
  return apiGet<PageResponse<ThreatSourceItem>>(
    "/api/v1/threat-intelligence/sources?page=1&page_size=100",
  );
}
