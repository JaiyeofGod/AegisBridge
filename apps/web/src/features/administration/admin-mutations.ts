import type { QueryClient } from "@tanstack/react-query";

/** Refresh administration list/summary/audit surfaces after a successful write. */
export async function invalidateAdministrationWrites(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ["administration"] });
}
