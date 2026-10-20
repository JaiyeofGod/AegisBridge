import { useQuery } from "@tanstack/react-query";

import { mapOverview } from "@/features/overview/mapOverview";
import { fetchOverview } from "@/services/overview";

export function useOverviewData() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
    select: mapOverview,
    retry: false,
    staleTime: 30_000,
  });
}
