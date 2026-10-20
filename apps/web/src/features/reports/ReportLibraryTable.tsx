import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status/StatusBadge";
import type { ReportRecord, ReportStatus } from "@/types/reports";

const selectClass =
  "min-h-11 min-w-[140px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function statusTone(status: ReportStatus): "success" | "warning" | "accent" {
  if (status === "Ready") return "success";
  if (status === "Review") return "warning";
  return "accent";
}

export function ReportLibraryTable({
  reports,
  selectedId,
  onSelect,
}: {
  reports: ReportRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");

  const owners = useMemo(
    () => Array.from(new Set(reports.map((item) => item.owner))).sort(),
    [reports],
  );

  const filtered = reports.filter((item) => {
    const haystack = `${item.reportId} ${item.name} ${item.type} ${item.scope}`.toLowerCase();
    const matchesQuery = query.trim().length === 0 || haystack.includes(query.trim().toLowerCase());
    return (
      matchesQuery &&
      (status === "all" || item.status === status) &&
      (owner === "all" || item.owner === owner)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="min-w-[200px] flex-1">
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="report-search"
          >
            Search records
          </label>
          <input
            id="report-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <Filter
          id="report-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={["Ready", "Review", "Scheduled"]}
        />
        <Filter
          id="report-owner"
          label="Owner"
          value={owner}
          onChange={setOwner}
          options={owners}
        />
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Report library with type, owner, generated time, freshness, status, format, and scope
          </caption>
          <thead className="text-[var(--muted)]">
            <tr>
              {[
                "Report",
                "Type",
                "Scope",
                "Owner",
                "Generated",
                "Freshness",
                "Status",
                "Format",
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
                <td colSpan={8} className="px-3 py-8 text-[var(--muted)]">
                  No reports match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      aria-pressed={selectedId === item.id}
                      onClick={() => onSelect(item.id)}
                      className="inline-flex min-h-11 flex-col items-start justify-center text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      <span className="font-medium text-[var(--text)]">{item.name}</span>
                      <span className="text-xs text-[var(--muted)]">{item.reportId}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.type}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.scope}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.owner}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                    {item.generatedLabel}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.freshness}</td>
                  <td className="px-3 py-3">
                    <StatusBadge label={item.status} tone={statusTone(item.status)} />
                  </td>
                  <td className="px-3 py-3 text-[var(--text)]">{item.format}</td>
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
              aria-pressed={selectedId === item.id}
              onClick={() => onSelect(item.id)}
              className="flex min-h-11 w-full flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <span className="font-medium text-[var(--text)]">
                {item.reportId} · {item.name}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {item.status} · {item.format} · {item.freshness}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[var(--muted)]">
        Showing {filtered.length} of {reports.length} sample records · Row selection opens record
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
