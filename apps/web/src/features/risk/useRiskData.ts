import { useCallback, useMemo, useState } from "react";

import { riskMock } from "@/mocks/risk";
import type { RiskSnapshot } from "@/types/risk";

type LoadState = "ready" | "loading" | "error";

/** Deterministic mock source shaped like a future query hook. */
export function useRiskData() {
  const [state, setState] = useState<LoadState>("ready");
  const [data, setData] = useState<RiskSnapshot>(riskMock);

  const reload = useCallback(() => {
    setState("loading");
    window.setTimeout(() => {
      setData(riskMock);
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
