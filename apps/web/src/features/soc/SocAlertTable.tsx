import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status/StatusBadge";
import type { AlertSeverity, AlertStatus, SocAlert } from "@/types/soc";

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
  selectedId,
  onSelect,
}: {
  alerts: SocAlert[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [asset, setAsset] = useState("all");
  const [attack, setAttack] = useState("all");
  const [owner, setOwner] = useState("all");

  const assets = useMemo(
    () => Array.from(new Set(alerts.map((item) => item.assetHostname))).sort(),
    [alerts],
  );
  const techniques = useMemo(
    () =>
      Array.from(
        new Set(alerts.map((item) => `${item.attackTactic} · ${item.attackTechniqueId}`)),
      ).sort(),
    [alerts],
  );
  const owners = useMemo(
    () => Array.from(new Set(alerts.map((item) => item.assignee))).sort(),
    [alerts],
  );

  const filtered = alerts.filter((item) => {
    const haystack =
      `${item.alertId} ${item.detectionName} ${item.assetHostname} ${item.account ?? ""} ${item.attackTechniqueId} ${item.telemetrySource}`.toLowerCase();
    const matchesQuery = query.trim().length === 0 || haystack.includes(query.trim().toLowerCase());
    const techniqueKey = `${item.attackTactic} · ${item.attackTechniqueId}`;
    return (
      matchesQuery &&
      (severity === "all" || item.severity === severity) &&
      (status === "all" || item.status === status) &&
      (asset === "all" || item.assetHostname === asset) &&
      (attack === "all" || techniqueKey === attack) &&
      (owner === "all" || item.assignee === owner)
    );
  });

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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <Filter
          id="soc-severity"
          label="Severity"
          value={severity}
          onChange={setSeverity}
          options={["Critical", "High", "Medium", "Low"]}
        />
        <Filter
          id="soc-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={["New", "Requires review", "Investigation opened"]}
        />
        <Filter
          id="soc-asset"
          label="Source asset"
          value={asset}
          onChange={setAsset}
          options={assets}
        />
        <Filter
          id="soc-attack"
          label="ATT&CK tactic or technique"
          value={attack}
          onChange={setAttack}
          options={techniques}
        />
        <Filter id="soc-owner" label="Owner" value={owner} onChange={setOwner} options={owners} />
        <Filter
          id="soc-saved-views"
          label="Saved views"
          value="current"
          onChange={() => undefined}
          options={["Current queue"]}
          optionValue={() => "current"}
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-[var(--muted)]">
                  No alerts match the current filters. Clear filters to see the sample queue.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
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
        {filtered.map((item) => (
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
        Showing {filtered.length} of {alerts.length} sample records · Row selection opens record
        details
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
  optionValue,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  optionValue?: (option: string) => string;
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
          <option key={option} value={optionValue ? optionValue(option) : option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
