import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { AttackTechniqueQuery } from "@/services/api-types";
import { fetchAttackTactics, fetchAttackTechnique, fetchAttackTechniques } from "@/services/attack";

export function useAttackTactics(includeDeprecated: boolean) {
  return useQuery({
    queryKey: ["attack", "tactics", includeDeprecated],
    queryFn: () => fetchAttackTactics(includeDeprecated),
    retry: false,
    staleTime: 30_000,
  });
}

export function useAttackTechniques(query: AttackTechniqueQuery) {
  return useQuery({
    queryKey: ["attack", "techniques", query],
    queryFn: () => fetchAttackTechniques(query),
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useAttackTechnique(techniqueId: string) {
  return useQuery({
    queryKey: ["attack", "technique", techniqueId],
    queryFn: () => fetchAttackTechnique(techniqueId),
    enabled: techniqueId.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}
