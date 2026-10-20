import { useState } from "react";

import { StatusBadge } from "@/components/status/StatusBadge";
import type { IntegrationRecord, IntegrationStatus } from "@/types/administration";

const selectClass =
  "min-h-11 min-w-[160px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const statuses: IntegrationStatus[] = [
  "Not configured",
  "Configured",
  "Simulated",
  "Healthy",
  "Delayed",
  "Disabled",
  "Planned",
];

function statusTone(status: IntegrationStatus): "success" | "warning" | "accent" | "neutral" {
  if (status === "Delayed") return "warning";
  if (status === "Configured" || status === "Simulated") return "accent";
  if (status === "Healthy") return "success";
  return "neutral";
}

export function IntegrationTable({
  integrations,
  selectedId,
  onSelect,
}: {
  integrations: IntegrationRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = integrations.filter((item) => {
    const haystack = `${item.name} ${item.category} ${item.scope}`.toLowerCase();
    const matchesQuery = query.trim().length === 0 || haystack.includes(query.trim().toLowerCase());
    return matchesQuery && (status === "all" || item.status === status);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="min-w-[200px] flex-1">
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="admin-search"
          >
            Search records
          </label>
          <input
            id="admin-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="admin-status"
          >
            Status
          </label>
          <select
            id="admin-status"
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All</option>
            {statuses.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Integration connectors with category, status, last sync, freshness, environment, and
            configuration state. No stored secrets.
          </caption>
          <thead className="text-[var(--muted)]">
            <tr>
              {[
                "Integration",
                "Category",
                "Status",
                "Last sync",
                "Freshness",
                "Environment",
                "Auth state",
              ].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-3">
                  <button
                    type="button"
                    aria-pressed={selectedId === item.id}
                    onClick={() => onSelect(item.id)}
                    className="inline-flex min-h-11 items-center font-medium text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    {item.name}
                  </button>
                </td>
                <td className="px-3 py-3 text-[var(--muted)]">{item.category}</td>
                <td className="px-3 py-3">
                  <StatusBadge label={item.status} tone={statusTone(item.status)} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">{item.lastSync}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{item.freshness}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{item.environment}</td>
                <td className="px-3 py-3 text-[var(--text)]">{item.authState}</td>
              </tr>
            ))}
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
              <span className="font-medium text-[var(--text)]">{item.name}</span>
              <span className="text-xs text-[var(--muted)]">
                {item.status} · {item.freshness}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[var(--muted)]">
        Showing {filtered.length} of {integrations.length} sample records · Row selection opens
        record details
      </p>
    </div>
  );
}
