import { apiGet } from "@/services/api-client";
import type {
  AttackTacticItem,
  AttackTechniqueDetail,
  AttackTechniqueListItem,
  AttackTechniqueQuery,
  PageResponse,
} from "@/services/api-types";

export function fetchAttackTactics(includeDeprecated = false) {
  const params = new URLSearchParams();
  if (includeDeprecated) params.set("include_deprecated", "true");
  const query = params.toString();
  return apiGet<AttackTacticItem[]>(`/api/v1/attack/tactics${query ? `?${query}` : ""}`);
}

export function fetchAttackTechniques(query: AttackTechniqueQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 25));
  if (query.q) params.set("q", query.q);
  if (query.tactic) params.set("tactic", query.tactic);
  if (query.includeSubtechniques !== undefined) {
    params.set("include_subtechniques", query.includeSubtechniques ? "true" : "false");
  }
  if (query.includeDeprecated !== undefined) {
    params.set("include_deprecated", query.includeDeprecated ? "true" : "false");
  }
  return apiGet<PageResponse<AttackTechniqueListItem>>(
    `/api/v1/attack/techniques?${params.toString()}`,
  );
}

export function fetchAttackTechnique(techniqueId: string) {
  return apiGet<AttackTechniqueDetail>(
    `/api/v1/attack/techniques/${encodeURIComponent(techniqueId)}`,
  );
}
