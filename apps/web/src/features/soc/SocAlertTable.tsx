import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status/StatusBadge";
import type { AlertSeverity, AlertStatus, SocAlert } from "@/types/soc";

export type SocTableFilters = {
  search: string;
  severity: string;
  status: string;
  asset: string;
  attack: string;
};

export type SocFilterOption = { value: string; label: string };

const selectClass =
  "min-h-11 min-w-[140px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function severityTone(severity: AlertSeverity): "critical" | "warning" | "neutral" {
  if (severity === "Critical" || severity === "High") return "critical";
  if (severity === "Medium") return "warning";
  return "neutral";
}

function statusTone(status: AlertStatus): "warning" | "accent" | "neutral" {
  if (status === "Investigation opened") return "accent";
  if (status === "Requires review" || status === "New") return "warning";
  return "neutral";
}

export function SocAlertTable({
  alerts,
  total,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
  assetOptions,
  techniqueOptions,
}: {
  alerts: SocAlert[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
  filters: SocTableFilters;
  onFiltersChange: (filters: SocTableFilters) => void;
  assetOptions: SocFilterOption[];
  techniqueOptions: SocFilterOption[];
}) {
  const [owner, setOwner] = useState("all");
  const owners = useMemo(
    () => Array.from(new Set(alerts.map((item) => item.assignee))).sort(),
    [alerts],
  );
  const visible = alerts.filter((item) => owner === "all" || item.assignee === owner);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="min-w-[200px] flex-1">
          <label className="mb-2 block text-sm font-medium text-[var(--text)]" htmlFor="soc-search">
            Search records
          </label>
          <input
            id="soc-search"
            type="search"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <Filter
          id="soc-severity"
          label="Severity"
          value={filters.severity}
          onChange={(severity) => onFiltersChange({ ...filters, severity })}
          options={[
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />
        <Filter
          id="soc-status"
          label="Status"
          value={filters.status}
          onChange={(status) => onFiltersChange({ ...filters, status })}
          options={[
            { value: "new", label: "New" },
            { value: "requires review", label: "Requires review" },
            { value: "investigation opened", label: "Investigation opened" },
          ]}
        />
        <Filter
          id="soc-asset"
          label="Source asset"
          value={filters.asset}
          onChange={(asset) => onFiltersChange({ ...filters, asset })}
          options={assetOptions}
        />
        <Filter
          id="soc-attack"
          label="ATT&CK tactic or technique"
          value={filters.attack}
          onChange={(attack) => onFiltersChange({ ...filters, attack })}
          options={techniqueOptions}
        />
        <Filter
          id="soc-owner"
          label="Owner"
          value={owner}
          onChange={setOwner}
          options={owners.map((name) => ({ value: name, label: name }))}
        />
        <Filter
          id="soc-saved-views"
          label="Saved views"
          value="current"
          onChange={() => undefined}
          options={[{ value: "current", label: "Current queue" }]}
        />
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Alert review queue with severity, status, asset, ATT&CK technique, investigation,
            telemetry source, and freshness kept as separate columns
          </caption>
          <thead className="bg-[var(--raised)] text-[var(--muted)]">
            <tr>
              {[
                "Alert",
                "Time",
                "Detection",
                "Severity",
                "Asset",
                "Account",
                "ATT&CK",
                "Status",
                "Investigation",
                "Telemetry",
                "Freshness",
              ].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-[var(--muted)]">
                  No alerts are stored for the current request.
                </td>
              </tr>
            ) : (
              visible.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      aria-pressed={selectedId === item.id}
                      className="inline-flex min-h-11 items-center font-medium text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      {item.alertId}
                    </button>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                    {item.timestampLabel}
                  </td>
                  <td className="px-3 py-3 text-[var(--text)]">{item.detectionName}</td>
                  <td className="px-3 py-3">
                    <StatusBadge label={item.severity} tone={severityTone(item.severity)} />
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.assetHostname}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {item.account ?? "Not in alert"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-[var(--text)]">
                    {item.attackTechniqueId}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge label={item.status} tone={statusTone(item.status)} />
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {item.investigationId ?? "None"}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.telemetrySource}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.freshness}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {visible.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">
            No alerts are stored for the current request.
          </li>
        ) : null}
        {visible.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-pressed={selectedId === item.id}
              className="flex min-h-11 w-full flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <span className="font-medium text-[var(--text)]">
                {item.alertId} · {item.assetHostname}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {item.severity} · {item.status} · {item.attackTechniqueId} · {item.freshness}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[var(--muted)]">
        Showing {visible.length} of {total} development records · Row selection opens record details
      </p>
    </div>
  );
}

function Filter({
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
  options: SocFilterOption[];
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
        {id === "soc-saved-views" ? null : <option value="all">All</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
