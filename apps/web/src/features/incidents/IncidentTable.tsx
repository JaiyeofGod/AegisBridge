import { StatusBadge } from "@/components/status/StatusBadge";
import type { IncidentRecord, IncidentSeverity, IncidentStatus } from "@/types/incident";

export type IncidentTableFilters = {
  search: string;
  severity: string;
  status: string;
  owner: string;
  containment: string;
};

export type IncidentFilterOption = { value: string; label: string };

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

const statuses: IncidentFilterOption[] = [
  "New",
  "Investigating",
  "Containment",
  "Eradication",
  "Recovery",
  "Resolved",
  "Closed",
].map((label) => ({ value: label.toLowerCase(), label }));

const severities: IncidentFilterOption[] = ["Critical", "High", "Medium", "Low"].map((label) => ({
  value: label.toLowerCase(),
  label,
}));

const containmentStates: IncidentFilterOption[] = [
  "Not started",
  "Awaiting decision",
  "In progress",
  "Contained",
  "Not required",
].map((label) => ({ value: label, label }));

export function IncidentTable({
  incidents,
  total,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
  ownerOptions,
}: {
  incidents: IncidentRecord[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
  filters: IncidentTableFilters;
  onFiltersChange: (filters: IncidentTableFilters) => void;
  ownerOptions: IncidentFilterOption[];
}) {
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
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <Filter
          id="incident-severity"
          label="Severity"
          value={filters.severity}
          onChange={(severity) => onFiltersChange({ ...filters, severity })}
          options={severities}
        />
        <Filter
          id="incident-status"
          label="Status"
          value={filters.status}
          onChange={(status) => onFiltersChange({ ...filters, status })}
          options={statuses}
        />
        <Filter
          id="incident-owner"
          label="Owner"
          value={filters.owner}
          onChange={(owner) => onFiltersChange({ ...filters, owner })}
          options={ownerOptions}
        />
        <Filter
          id="incident-containment"
          label="Containment state"
          value={filters.containment}
          onChange={(containment) => onFiltersChange({ ...filters, containment })}
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
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-[var(--muted)]">
                  No incidents are stored for the current request.
                </td>
              </tr>
            ) : (
              incidents.map((item) => (
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
                      : "No affected assets are stored."}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {item.relatedAlerts.length > 0
                      ? item.relatedAlerts.join(", ")
                      : "No related alerts are stored."}
                  </td>
                  <td className="px-3 py-3 text-[var(--text)]">
                    {item.attackMappings[0] ?? "Not stored"}
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
        {incidents.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">
            No incidents are stored for the current request.
          </li>
        ) : null}
        {incidents.map((item) => (
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
        Showing {incidents.length} of {total} development records · Row selection opens record
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
  options: IncidentFilterOption[];
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
