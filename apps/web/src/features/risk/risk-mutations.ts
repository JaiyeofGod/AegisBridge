import type { QueryClient } from "@tanstack/react-query";

/** Refresh the risk detail and control views that show a risk↔control mapping. */
export async function invalidateRiskControlMappings(
  queryClient: QueryClient,
  options: { riskId: string; controlId?: string },
) {
  await queryClient.invalidateQueries({ queryKey: ["risks", "detail", options.riskId] });
  await queryClient.invalidateQueries({ queryKey: ["governance", "controls"] });
  if (options.controlId) {
    await queryClient.invalidateQueries({
      queryKey: ["governance", "control", options.controlId],
    });
  } else {
    await queryClient.invalidateQueries({ queryKey: ["governance", "control"] });
  }
}
