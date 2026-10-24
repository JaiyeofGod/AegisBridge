import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { IndicatorQuery } from "@/services/api-types";
import {
  fetchAdvisories,
  fetchIndicator,
  fetchIndicators,
  fetchThreatIntelSummary,
  fetchThreatSources,
} from "@/services/threat-intel";

const indicatorsKey = ["threat-intel", "indicators"] as const;

export const INDICATOR_PAGE_SIZE = 25;

export function useThreatIntelSummary() {
  return useQuery({
    queryKey: ["threat-intel", "summary"],
    queryFn: fetchThreatIntelSummary,
    retry: false,
    staleTime: 30_000,
  });
}

export function useIndicatorList(query: IndicatorQuery) {
  return useQuery({
    queryKey: [...indicatorsKey, query],
    queryFn: () =>
      fetchIndicators({
        ...query,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? INDICATOR_PAGE_SIZE,
      }),
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useIndicatorDetail(indicatorId: string) {
  return useQuery({
    queryKey: [...indicatorsKey, "detail", indicatorId],
    queryFn: () => fetchIndicator(indicatorId),
    enabled: indicatorId.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}

export function useAdvisories() {
  return useQuery({
    queryKey: ["threat-intel", "advisories"],
    queryFn: fetchAdvisories,
    retry: false,
    staleTime: 30_000,
  });
}

export function useThreatSources() {
  return useQuery({
    queryKey: ["threat-intel", "sources"],
    queryFn: fetchThreatSources,
    retry: false,
    staleTime: 30_000,
  });
}
