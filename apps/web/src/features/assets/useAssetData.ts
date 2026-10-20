import { useMemo } from "react";

import { assetMock } from "@/mocks/assets";

/** Deterministic mock source for the asset inventory. */
export function useAssetData() {
  return useMemo(
    () => ({
      state: "ready" as const,
      data: assetMock,
      isSimulated: true as const,
    }),
    [],
  );
}
