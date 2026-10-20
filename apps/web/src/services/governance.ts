import { apiGet } from "@/services/api-client";
import type { GovernanceSummary } from "@/services/api-types";

export function fetchGovernanceSummary() {
  return apiGet<GovernanceSummary>("/api/v1/governance/summary");
}
