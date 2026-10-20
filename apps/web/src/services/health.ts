import { apiGet } from "@/services/api-client";

export type HealthLiveResponse = {
  status: string;
  service: string;
};

export function fetchHealthLive() {
  return apiGet<HealthLiveResponse>("/api/v1/health/live");
}
