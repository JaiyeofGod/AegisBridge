import { useCallback, useMemo, useState } from "react";

import { overviewMock } from "@/mocks/overview";
import type { OverviewSnapshot } from "@/types/overview";

type LoadState = "ready" | "loading" | "error";

/**
 * Phase 1 uses deterministic mocks. Shape mirrors a future TanStack Query hook
 * so API wiring can replace the source without rewriting the page.
 */
export function useOverviewData() {
  const [state, setState] = useState<LoadState>("ready");
  const [data, setData] = useState<OverviewSnapshot>(overviewMock);

  const reload = useCallback(() => {
    setState("loading");
    window.setTimeout(() => {
      setData(overviewMock);
      setState("ready");
    }, 350);
  }, []);

  const simulateError = useCallback(() => {
    setState("error");
  }, []);

  return useMemo(
    () => ({
      state,
      data,
      reload,
      simulateError,
      isSimulated: true as const,
    }),
    [state, data, reload, simulateError],
  );
}
