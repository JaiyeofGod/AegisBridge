import { apiGet, apiPatch, apiPostCsrf } from "@/services/api-client";
import type {
  IncidentDetailResponse,
  IncidentListItem,
  IncidentQuery,
  IncidentTaskCreate,
  IncidentTaskQuery,
  IncidentTaskRecord,
  IncidentTaskUpdate,
  IncidentUpdate,
  PageResponse,
} from "@/services/api-types";

export function fetchIncidents(query: IncidentQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.severity) params.set("severity", query.severity);
  if (query.status) params.set("status", query.status);
  if (query.owner) params.set("owner", query.owner);
  if (query.containmentState) params.set("containment_state", query.containmentState);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<IncidentListItem>>(`/api/v1/incidents?${params.toString()}`);
}

export function fetchIncident(incidentId: string) {
  return apiGet<IncidentDetailResponse>(`/api/v1/incidents/${encodeURIComponent(incidentId)}`);
}

export function updateIncident(incidentId: string, patch: IncidentUpdate) {
  return apiPatch<IncidentDetailResponse>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}`,
    patch,
  );
}

export function fetchIncidentTasks(incidentId: string, query: IncidentTaskQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 25));
  if (query.status) params.set("status", query.status);
  return apiGet<PageResponse<IncidentTaskRecord>>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/tasks?${params.toString()}`,
  );
}

export function createIncidentTask(incidentId: string, body: IncidentTaskCreate) {
  return apiPostCsrf<IncidentTaskRecord>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/tasks`,
    body,
  );
}

export function updateIncidentTask(incidentId: string, taskId: string, patch: IncidentTaskUpdate) {
  return apiPatch<IncidentTaskRecord>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/tasks/${encodeURIComponent(taskId)}`,
    patch,
  );
}
