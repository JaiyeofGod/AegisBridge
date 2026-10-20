import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { applyRiskDetail, mapRiskInventory } from "@/features/risk/mapRisk";
import type { RiskQuery } from "@/services/api-types";
import { fetchRisk, fetchRisks } from "@/services/risks";

const listKey = ["risks", "list"] as const;

export function useRiskCatalog() {
  return useQuery({
    queryKey: [...listKey, "catalog"],
    queryFn: () => fetchRisks({ pageSize: 100 }),
    retry: false,
    staleTime: 30_000,
  });
}

export function useRiskList(query: RiskQuery, enabled: boolean) {
  return useQuery({
    queryKey: [...listKey, query],
    queryFn: () => fetchRisks({ ...query, pageSize: 100 }),
    enabled,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useRiskDetail(riskId: string) {
  return useQuery({
    queryKey: ["risks", "detail", riskId],
    queryFn: () => fetchRisk(riskId),
    enabled: riskId.length > 0,
    retry: false,
    staleTime: 30_000,
    select: (detail) => applyRiskDetail(detail),
  });
}

export { mapRiskInventory };
