import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { LabDetectionQuery, LabScenarioQuery, LabSystemQuery } from "@/services/api-types";
import {
  fetchCyberRangeSummary,
  fetchLabDetections,
  fetchLabScenario,
  fetchLabScenarios,
  fetchLabSystem,
  fetchLabSystemRelationships,
  fetchLabSystems,
  fetchLabTelemetry,
  fetchLabZones,
} from "@/services/cyber-range";

const systemsKey = ["cyber-range", "systems"] as const;

export const labSystemRelationshipsKey = [...systemsKey, "relationships"] as const;
const scenariosKey = ["cyber-range", "scenarios"] as const;
const detectionsKey = ["cyber-range", "detections"] as const;

export function useCyberRangeSummary() {
  return useQuery({
    queryKey: ["cyber-range", "summary"],
    queryFn: fetchCyberRangeSummary,
    retry: false,
    staleTime: 30_000,
  });
}

export function useLabZones() {
  return useQuery({
    queryKey: ["cyber-range", "zones"],
    queryFn: fetchLabZones,
    retry: false,
    staleTime: 30_000,
  });
}

export function useLabSystemCatalog() {
  return useQuery({
    queryKey: [...systemsKey, "catalog"],
    queryFn: () => fetchLabSystems({ pageSize: 100 }),
    retry: false,
    staleTime: 30_000,
  });
}

export function useLabSystemList(query: LabSystemQuery, enabled: boolean) {
  return useQuery({
    queryKey: [...systemsKey, query],
    queryFn: () => fetchLabSystems({ ...query, pageSize: 100 }),
    enabled,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useLabSystemRelationships() {
  return useQuery({
    queryKey: labSystemRelationshipsKey,
    queryFn: fetchLabSystemRelationships,
    retry: false,
    staleTime: 30_000,
  });
}

export function useLabSystemDetail(systemId: string) {
  return useQuery({
    queryKey: [...systemsKey, "detail", systemId],
    queryFn: () => fetchLabSystem(systemId),
    enabled: systemId.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}

export function useLabScenarioCatalog() {
  return useQuery({
    queryKey: [...scenariosKey, "catalog"],
    queryFn: () => fetchLabScenarios({ pageSize: 100 }),
    retry: false,
    staleTime: 30_000,
  });
}

export function useLabScenarioList(query: LabScenarioQuery, enabled: boolean) {
  return useQuery({
    queryKey: [...scenariosKey, query],
    queryFn: () => fetchLabScenarios({ ...query, pageSize: 100 }),
    enabled,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useLabScenarioDetail(scenarioId: string) {
  return useQuery({
    queryKey: [...scenariosKey, "detail", scenarioId],
    queryFn: () => fetchLabScenario(scenarioId),
    enabled: scenarioId.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}

export function useLabTelemetry() {
  return useQuery({
    queryKey: ["cyber-range", "telemetry"],
    queryFn: fetchLabTelemetry,
    retry: false,
    staleTime: 30_000,
  });
}

export function useLabDetectionCatalog() {
  return useQuery({
    queryKey: [...detectionsKey, "catalog"],
    queryFn: () => fetchLabDetections({ pageSize: 100 }),
    retry: false,
    staleTime: 30_000,
  });
}

export function useLabDetectionList(query: LabDetectionQuery, enabled: boolean) {
  return useQuery({
    queryKey: [...detectionsKey, query],
    queryFn: () => fetchLabDetections({ ...query, pageSize: 100 }),
    enabled,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
