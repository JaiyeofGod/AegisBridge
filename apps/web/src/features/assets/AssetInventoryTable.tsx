import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/status/StatusBadge";
import type { AssetRecord, TelemetryStatus } from "@/types/asset";

const selectClass =
  "min-h-11 min-w-[150px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function telemetryTone(status: TelemetryStatus): "critical" | "warning" | "success" | "accent" {
  if (status === "Missing") return "critical";
  if (status === "Stale" || status === "Active alerts") return "warning";
  return "success";
}

function inventoryStatus(asset: AssetRecord): string {
  if (asset.slug === "FIN-APP-01") return `${asset.vulnerabilityCount} open findings`;
  if (asset.telemetryStatus === "Active alerts")
    return `${asset.openIncidentCount || 3} active alerts`;
  return asset.telemetryStatus;
}

export function AssetInventoryTable({
  assets,
  selectedSlug,
  onSelect,
}: {
  assets: AssetRecord[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [assetType, setAssetType] = useState("all");
  const [criticality, setCriticality] = useState("all");
  const [environment, setEnvironment] = useState("all");
  const [telemetry, setTelemetry] = useState("all");

  const types = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.assetType))).sort(),
    [assets],
  );

  const filtered = assets.filter((asset) => {
    const haystack =
      `${asset.assetId} ${asset.hostname} ${asset.name} ${asset.assetType} ${asset.owner} ${asset.department}`.toLowerCase();
    const matchesQuery = query.trim().length === 0 || haystack.includes(query.trim().toLowerCase());
    return (
      matchesQuery &&
      (assetType === "all" || asset.assetType === assetType) &&
      (criticality === "all" || asset.criticality === criticality) &&
      (environment === "all" || asset.environment === environment) &&
      (telemetry === "all" || asset.telemetryStatus === telemetry)
    );
  });

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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <FilterSelect
          id="asset-type"
          label="Asset type"
          value={assetType}
          onChange={setAssetType}
          options={types}
        />
        <FilterSelect
          id="asset-criticality"
          label="Criticality"
          value={criticality}
          onChange={setCriticality}
          options={["Low", "Medium", "High", "Critical"]}
        />
        <FilterSelect
          id="asset-environment"
          label="Environment"
          value={environment}
          onChange={setEnvironment}
          options={["Production", "Lab", "Development"]}
        />
        <FilterSelect
          id="asset-telemetry"
          label="Telemetry status"
          value={telemetry}
          onChange={setTelemetry}
          options={["Reporting", "Missing", "Stale", "Active alerts"]}
        />
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Asset inventory sample with type, service, owner, and text status
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-[var(--muted)]">
                  No assets match the current filters. Clear filters to see the sample inventory.
                </td>
              </tr>
            ) : (
              filtered.map((asset) => (
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
        {filtered.map((asset) => (
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
        Showing {filtered.length} of {assets.length} sample records · Row selection opens record
        details
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
  options: string[];
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
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
