import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { AlertQuery } from "@/services/api-types";
import { fetchAlert, fetchAlerts } from "@/services/alerts";

const listKey = ["alerts", "list"] as const;

export function useAlertCatalog() {
  return useQuery({
    queryKey: [...listKey, "catalog"],
    queryFn: () => fetchAlerts({ pageSize: 100 }),
    retry: false,
    staleTime: 30_000,
  });
}

export function useAlertList(query: AlertQuery, enabled: boolean) {
  return useQuery({
    queryKey: [...listKey, query],
    queryFn: () => fetchAlerts({ ...query, pageSize: 100 }),
    enabled,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useAlertDetail(alertId: string) {
  return useQuery({
    queryKey: ["alerts", "detail", alertId],
    queryFn: () => fetchAlert(alertId),
    enabled: alertId.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}
