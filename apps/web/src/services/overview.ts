import { apiGet } from "@/services/api-client";
import type { OverviewResponse } from "@/services/api-types";

export function fetchOverview() {
  return apiGet<OverviewResponse>("/api/v1/overview");
}
