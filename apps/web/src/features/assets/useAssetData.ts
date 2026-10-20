import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { mapAssetDetail, mapInventory } from "@/features/assets/mapAsset";
import { ApiError } from "@/services/api-client";
import type { AssetQuery } from "@/services/api-types";
import { fetchAssetByRouteKey, fetchAssets } from "@/services/assets";

const listKey = ["assets", "list"] as const;

export function useAssetCatalog() {
  return useQuery({
    queryKey: [...listKey, "catalog"],
    queryFn: () => fetchAssets({ pageSize: 100 }),
    retry: false,
    staleTime: 30_000,
  });
}

export function useAssetList(query: AssetQuery, enabled: boolean) {
  return useQuery({
    queryKey: [...listKey, query],
    queryFn: () => fetchAssets({ ...query, pageSize: 100 }),
    enabled,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useAssetDetail(routeKey: string) {
  return useQuery({
    queryKey: ["assets", "detail", routeKey],
    queryFn: () => fetchAssetByRouteKey(routeKey),
    enabled: routeKey.length > 0,
    retry: false,
    staleTime: 30_000,
    select: mapAssetDetail,
  });
}

export function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export { mapInventory };
