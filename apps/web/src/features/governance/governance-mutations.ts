import type { QueryClient } from "@tanstack/react-query";

/** Refresh governance summary, control lists, and a selected control after writes. */
export async function invalidateGovernanceWrites(
  queryClient: QueryClient,
  options?: { controlId?: string; evidenceId?: string; policyId?: string },
) {
  await queryClient.invalidateQueries({ queryKey: ["governance", "summary"] });
  await queryClient.invalidateQueries({ queryKey: ["governance", "controls"] });
  if (options?.controlId) {
    await queryClient.invalidateQueries({
      queryKey: ["governance", "control", options.controlId],
    });
  } else {
    await queryClient.invalidateQueries({ queryKey: ["governance", "control"] });
  }
  if (options?.evidenceId) {
    await queryClient.invalidateQueries({
      queryKey: ["evidence", "detail", options.evidenceId],
    });
  }
  await queryClient.invalidateQueries({ queryKey: ["policies"] });
  if (options?.policyId) {
    await queryClient.invalidateQueries({
      queryKey: ["policies", "detail", options.policyId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["policies", "versions", options.policyId],
    });
  }
}
