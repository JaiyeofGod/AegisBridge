import { useQuery } from "@tanstack/react-query";

import {
  fetchGovernanceControl,
  fetchGovernanceControls,
  fetchGovernanceSummary,
} from "@/services/governance";

export function useGovernanceSummary() {
  return useQuery({
    queryKey: ["governance", "summary"],
    queryFn: fetchGovernanceSummary,
    retry: false,
    staleTime: 30_000,
  });
}

export function useGovernanceControls() {
  return useQuery({
    queryKey: ["governance", "controls"],
    queryFn: () => fetchGovernanceControls(1, 50),
    retry: false,
    staleTime: 30_000,
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
