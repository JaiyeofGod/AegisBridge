import { ApiError, apiGet } from "@/services/api-client";
import type {
  AssetDetailResponse,
  AssetListItem,
  AssetQuery,
  PageResponse,
} from "@/services/api-types";

export function fetchAssets(query: AssetQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.assetType) params.set("asset_type", query.assetType);
  if (query.criticality) params.set("criticality", query.criticality);
  if (query.environment) params.set("environment", query.environment);
  if (query.telemetryStatus) params.set("telemetry_status", query.telemetryStatus);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<AssetListItem>>(`/api/v1/assets?${params.toString()}`);
}

export function fetchAsset(assetId: string) {
  return apiGet<AssetDetailResponse>(`/api/v1/assets/${encodeURIComponent(assetId)}`);
}

/** Route keys may be a hostname (`FIN-APP-01`) or a human id (`AST-0007`). */
export async function fetchAssetByRouteKey(routeKey: string): Promise<AssetDetailResponse> {
  const key = routeKey.trim();
  if (/^AST-\d+$/i.test(key)) return fetchAsset(key.toUpperCase());

  const page = await fetchAssets({ search: key, pageSize: 100 });
  const match = page.items.find(
    (item) =>
      item.hostname.toLowerCase() === key.toLowerCase() ||
      item.id.toLowerCase() === key.toLowerCase(),
  );
  if (!match) {
    throw new ApiError(`Asset ${key} was not found.`, 404);
  }
  return fetchAsset(match.id);
}
