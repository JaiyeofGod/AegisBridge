import { useQuery } from "@tanstack/react-query";

import { fetchGovernanceSummary } from "@/services/governance";

export function useGovernanceSummary() {
  return useQuery({
    queryKey: ["governance", "summary"],
    queryFn: fetchGovernanceSummary,
    retry: false,
    staleTime: 30_000,
  });
}
