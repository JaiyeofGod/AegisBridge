import { apiDelete, apiGet, apiPatch, apiPostCsrf } from "@/services/api-client";
import type {
  CyberRangeSummary,
  LabDetectionItem,
  LabDetectionQuery,
  LabScenarioDetail,
  LabScenarioListItem,
  LabScenarioQuery,
  LabSystemDetail,
  LabSystemListItem,
  LabSystemQuery,
  LabSystemRelationshipItem,
  LabSystemRelationshipWrite,
  LabTelemetryItem,
  LabZoneItem,
  PageResponse,
} from "@/services/api-types";

export function fetchCyberRangeSummary() {
  return apiGet<CyberRangeSummary>("/api/v1/cyber-range/summary");
}

export function fetchLabZones() {
  return apiGet<PageResponse<LabZoneItem>>("/api/v1/cyber-range/zones?page=1&page_size=100");
}

export function fetchLabSystems(query: LabSystemQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.zone) params.set("zone", query.zone);
  if (query.role) params.set("role", query.role);
  if (query.telemetryStatus) params.set("telemetry_status", query.telemetryStatus);
  if (query.observedState) params.set("observed_state", query.observedState);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<LabSystemListItem>>(
    `/api/v1/cyber-range/systems?${params.toString()}`,
  );
}

export function createLabSystemRelationship(body: LabSystemRelationshipWrite) {
  return apiPostCsrf<LabSystemRelationshipItem>("/api/v1/cyber-range/system-relationships", body);
}

export function updateLabSystemRelationship(
  relationshipId: string,
  body: LabSystemRelationshipWrite,
) {
  return apiPatch<LabSystemRelationshipItem>(
    `/api/v1/cyber-range/system-relationships/${encodeURIComponent(relationshipId)}`,
    body,
  );
}

export function deleteLabSystemRelationship(relationshipId: string) {
  return apiDelete<LabSystemRelationshipItem>(
    `/api/v1/cyber-range/system-relationships/${encodeURIComponent(relationshipId)}`,
  );
}

export function fetchLabSystemRelationships() {
  return apiGet<PageResponse<LabSystemRelationshipItem>>(
    "/api/v1/cyber-range/system-relationships?page=1&page_size=100",
  );
}

export function fetchLabSystem(systemId: string) {
  return apiGet<LabSystemDetail>(`/api/v1/cyber-range/systems/${encodeURIComponent(systemId)}`);
}

export function fetchLabScenarios(query: LabScenarioQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.category) params.set("category", query.category);
  if (query.attackTechnique) params.set("attack_technique", query.attackTechnique);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<LabScenarioListItem>>(
    `/api/v1/cyber-range/scenarios?${params.toString()}`,
  );
}

export function fetchLabScenario(scenarioId: string) {
  return apiGet<LabScenarioDetail>(
    `/api/v1/cyber-range/scenarios/${encodeURIComponent(scenarioId)}`,
  );
}

export function fetchLabTelemetry() {
  return apiGet<PageResponse<LabTelemetryItem>>(
    "/api/v1/cyber-range/telemetry?page=1&page_size=100",
  );
}

export function fetchLabDetections(query: LabDetectionQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.validationState) params.set("validation_state", query.validationState);
  if (query.attackTechnique) params.set("attack_technique", query.attackTechnique);
  if (query.dataSource) params.set("data_source", query.dataSource);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<LabDetectionItem>>(
    `/api/v1/cyber-range/detections?${params.toString()}`,
  );
}
