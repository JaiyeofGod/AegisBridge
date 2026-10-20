import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status/StatusBadge";
import type {
  ContainmentState,
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
} from "@/types/incident";

const selectClass =
  "min-h-11 min-w-[140px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function severityTone(severity: IncidentSeverity): "critical" | "warning" | "neutral" {
  if (severity === "Critical" || severity === "High") return "critical";
  if (severity === "Medium") return "warning";
  return "neutral";
}

function statusTone(status: IncidentStatus): "warning" | "accent" | "success" | "neutral" {
  if (status === "Investigating" || status === "New") return "warning";
  if (status === "Containment" || status === "Eradication" || status === "Recovery")
    return "accent";
  if (status === "Resolved" || status === "Closed") return "success";
  return "neutral";
}

const statuses: IncidentStatus[] = [
  "New",
  "Investigating",
  "Containment",
  "Eradication",
  "Recovery",
  "Resolved",
  "Closed",
];

const severities: IncidentSeverity[] = ["Critical", "High", "Medium", "Low"];

const containmentStates: ContainmentState[] = [
  "Not started",
  "Awaiting decision",
  "In progress",
  "Contained",
  "Not required",
];

export function IncidentTable({
  incidents,
  selectedId,
  onSelect,
}: {
  incidents: IncidentRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const [containment, setContainment] = useState("all");

  const owners = useMemo(
    () => Array.from(new Set(incidents.map((item) => item.owner))).sort(),
    [incidents],
  );

  const filtered = incidents.filter((item) => {
    const haystack =
      `${item.incidentId} ${item.title} ${item.affectedService} ${item.owner} ${item.assets.map((asset) => asset.hostname).join(" ")} ${item.relatedAlerts.join(" ")}`.toLowerCase();
    const matchesQuery = query.trim().length === 0 || haystack.includes(query.trim().toLowerCase());
    return (
      matchesQuery &&
      (severity === "all" || item.severity === severity) &&
      (status === "all" || item.status === status) &&
      (owner === "all" || item.owner === owner) &&
      (containment === "all" || item.containment === containment)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="min-w-[200px] flex-1">
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="incident-search"
          >
            Search records
          </label>
          <input
            id="incident-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <Filter
          id="incident-severity"
          label="Severity"
          value={severity}
          onChange={setSeverity}
          options={severities}
        />
        <Filter
          id="incident-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={statuses}
        />
        <Filter
          id="incident-owner"
          label="Owner"
          value={owner}
          onChange={setOwner}
          options={owners}
        />
        <Filter
          id="incident-containment"
          label="Containment state"
          value={containment}
          onChange={setContainment}
          options={containmentStates}
        />
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Incident queue with severity, lifecycle status, owner, assets, alerts, ATT&CK mapping,
            containment, evidence count, and open tasks kept as separate columns
          </caption>
          <thead className="bg-[var(--raised)] text-[var(--muted)]">
            <tr>
              {[
                "Incident",
                "Title",
                "Severity",
                "Status",
                "Created",
                "Owner",
                "Assets",
                "Alerts",
                "ATT&CK",
                "Containment",
                "Evidence",
                "Open tasks",
                "Updated",
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
                <td colSpan={13} className="px-3 py-8 text-[var(--muted)]">
                  No incidents match the current filters. Clear filters to see the sample queue.
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
                      {item.incidentId}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[var(--text)]">{item.title}</td>
                  <td className="px-3 py-3">
                    <StatusBadge label={item.severity} tone={severityTone(item.severity)} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge label={item.status} tone={statusTone(item.status)} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                    {item.createdLabel}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.owner}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {item.assets.length > 0
                      ? item.assets.map((asset) => asset.hostname).join(", ")
                      : item.affectedService}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {item.relatedAlerts.length > 0 ? item.relatedAlerts.join(", ") : "None"}
                  </td>
                  <td className="px-3 py-3 text-[var(--text)]">
                    {item.attackMappings[0] ?? "None"}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.containment}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.evidenceCount}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.openTaskCount}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                    {item.lastUpdateLabel}
                  </td>
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
                {item.incidentId} · {item.title}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {item.severity} · {item.status} · {item.containment}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[var(--muted)]">
        Showing {filtered.length} of {incidents.length} sample records · Row selection opens record
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
