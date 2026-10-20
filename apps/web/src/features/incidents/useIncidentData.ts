import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { IncidentQuery } from "@/services/api-types";
import { fetchIncident, fetchIncidents } from "@/services/incidents";

const listKey = ["incidents", "list"] as const;

export function useIncidentCatalog() {
  return useQuery({
    queryKey: [...listKey, "catalog"],
    queryFn: () => fetchIncidents({ pageSize: 100 }),
    retry: false,
    staleTime: 30_000,
  });
}

export function useIncidentList(query: IncidentQuery, enabled: boolean) {
  return useQuery({
    queryKey: [...listKey, query],
    queryFn: () => fetchIncidents({ ...query, pageSize: 100 }),
    enabled,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useIncidentDetail(incidentId: string) {
  return useQuery({
    queryKey: ["incidents", "detail", incidentId],
    queryFn: () => fetchIncident(incidentId),
    enabled: incidentId.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}
