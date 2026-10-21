import { apiGet } from "@/services/api-client";
import type {
  PageResponse,
  ReportDefinitionDetail,
  ReportDefinitionListItem,
  ReportDefinitionQuery,
  ReportsSummary,
} from "@/services/api-types";

export function fetchReportsSummary() {
  return apiGet<ReportsSummary>("/api/v1/reports/summary");
}

export function fetchReportDefinitions(query: ReportDefinitionQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.reportType) params.set("report_type", query.reportType);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<ReportDefinitionListItem>>(
    `/api/v1/reports/definitions?${params.toString()}`,
  );
}

export function fetchReportDefinition(reportId: string) {
  return apiGet<ReportDefinitionDetail>(
    `/api/v1/reports/definitions/${encodeURIComponent(reportId)}`,
  );
}
