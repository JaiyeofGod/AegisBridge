import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ControlListQuery } from "@/services/api-types";
import {
  fetchGovernanceControl,
  fetchGovernanceControls,
  fetchGovernanceSummary,
} from "@/services/governance";

export const GOVERNANCE_CONTROLS_QUERY_KEY = ["governance", "controls"] as const;

export function useGovernanceSummary() {
  return useQuery({
    queryKey: ["governance", "summary"],
    queryFn: fetchGovernanceSummary,
    retry: false,
    staleTime: 30_000,
  });
}

export function useGovernanceControls(query: ControlListQuery = {}) {
  return useQuery({
    queryKey: [...GOVERNANCE_CONTROLS_QUERY_KEY, query],
    queryFn: () => fetchGovernanceControls(query),
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useGovernanceControl(controlId: string | null) {
  return useQuery({
    queryKey: ["governance", "control", controlId],
    queryFn: () => fetchGovernanceControl(controlId!),
    enabled: Boolean(controlId),
    retry: false,
    staleTime: 15_000,
  });
}
