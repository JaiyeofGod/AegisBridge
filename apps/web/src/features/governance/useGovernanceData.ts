import { useCallback, useMemo, useState } from "react";

import { governanceMock } from "@/mocks/governance";
import type { GovernanceSnapshot } from "@/types/governance";

type LoadState = "ready" | "loading" | "error";

/**
 * Phase 1 uses deterministic mocks. Shape mirrors a future TanStack Query hook
 * so API wiring can replace the source without rewriting the page.
 */
export function useGovernanceData() {
  const [state, setState] = useState<LoadState>("ready");
  const [data, setData] = useState<GovernanceSnapshot>(governanceMock);

  const reload = useCallback(() => {
    setState("loading");
    window.setTimeout(() => {
      setData(governanceMock);
      setState("ready");
    }, 350);
  }, []);

  return useMemo(
    () => ({
      state,
      data,
      reload,
      isSimulated: true as const,
    }),
    [state, data, reload],
  );
}
