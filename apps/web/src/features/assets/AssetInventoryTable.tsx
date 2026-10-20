import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/status/StatusBadge";
import type { AssetRecord } from "@/types/asset";

export type FilterOption = { value: string; label: string };

export type AssetTableFilters = {
  search: string;
  assetType: string;
  criticality: string;
  environment: string;
  telemetry: string;
};

const selectClass =
  "min-h-11 min-w-[150px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function telemetryTone(status: string): "critical" | "warning" | "success" | "accent" {
  const normalized = status.toLowerCase();
  if (normalized === "missing" || normalized === "not_connected") return "critical";
  if (normalized === "stale" || normalized === "active alerts" || normalized === "reference_only") {
    return "warning";
  }
  if (normalized === "reporting" || normalized === "active") return "success";
  return "warning";
}

function inventoryStatus(asset: AssetRecord): string {
  return asset.telemetryStatus;
}

export function AssetInventoryTable({
  assets,
  total,
  selectedSlug,
  onSelect,
  filters,
  onFiltersChange,
  typeOptions,
  environmentOptions,
  telemetryOptions,
}: {
  assets: AssetRecord[];
  total: number;
  selectedSlug: string;
  onSelect: (slug: string) => void;
  filters: AssetTableFilters;
  onFiltersChange: (filters: AssetTableFilters) => void;
  typeOptions: FilterOption[];
  environmentOptions: FilterOption[];
  telemetryOptions: FilterOption[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[200px] flex-1">
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="asset-search"
          >
            Search records
          </label>
          <input
            id="asset-search"
            type="search"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <FilterSelect
          id="asset-type"
          label="Asset type"
          value={filters.assetType}
          onChange={(assetType) => onFiltersChange({ ...filters, assetType })}
          options={typeOptions}
        />
        <FilterSelect
          id="asset-criticality"
          label="Criticality"
          value={filters.criticality}
          onChange={(criticality) => onFiltersChange({ ...filters, criticality })}
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" },
          ]}
        />
        <FilterSelect
          id="asset-environment"
          label="Environment"
          value={filters.environment}
          onChange={(environment) => onFiltersChange({ ...filters, environment })}
          options={environmentOptions}
        />
        <FilterSelect
          id="asset-telemetry"
          label="Telemetry status"
          value={filters.telemetry}
          onChange={(telemetry) => onFiltersChange({ ...filters, telemetry })}
          options={telemetryOptions}
        />
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Asset inventory with type, service, owner, and text status
          </caption>
          <thead className="bg-[var(--raised)] text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Asset / type
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Service / segment
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Owner
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-[var(--muted)]">
                  No assets are stored for the current request.
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr key={asset.slug} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <Link
                      to={`/assets/${asset.slug}`}
                      onClick={() => onSelect(asset.slug)}
                      aria-current={selectedSlug === asset.slug ? "page" : undefined}
                      className="inline-flex min-h-11 flex-col justify-center text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      <span className="font-medium">
                        {asset.hostname} · {asset.assetId}
                      </span>
                      <span className="text-xs text-[var(--muted)]">{asset.assetType}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{asset.serviceSegment}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{asset.owner}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={inventoryStatus(asset)}
                      tone={telemetryTone(asset.telemetryStatus)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {assets.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">
            No assets are stored for the current request.
          </li>
        ) : null}
        {assets.map((asset) => (
          <li key={asset.slug}>
            <Link
              to={`/assets/${asset.slug}`}
              className="flex min-h-11 flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
            >
              <span className="font-medium text-[var(--text)]">
                {asset.hostname} · {asset.assetId}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {asset.assetType} · {asset.owner} · {inventoryStatus(asset)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[var(--muted)]">
        Showing {assets.length} of {total} development records · Row selection opens record details
      </p>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[var(--text)]" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
