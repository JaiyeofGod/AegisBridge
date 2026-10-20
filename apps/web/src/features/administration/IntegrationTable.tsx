import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status/StatusBadge";
import type { IntegrationView } from "@/features/administration/mapAdministration";

const selectClass =
  "min-h-11 min-w-[160px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function statusTone(status: string): "success" | "warning" | "accent" | "neutral" {
  if (status === "delayed") return "warning";
  if (status === "configured" || status === "reference_only") return "accent";
  if (status === "healthy") return "success";
  return "neutral";
}

export function IntegrationTable({
  integrations,
  selectedId,
  onSelect,
}: {
  integrations: IntegrationView[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const statuses = useMemo(
    () =>
      Array.from(new Set(integrations.map((item) => item.status))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [integrations],
  );
  const filtered = integrations.filter((item) => {
    const haystack = `${item.id} ${item.name} ${item.provider} ${item.status}`.toLowerCase();
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
                {integrations.find((item) => item.status === option)?.statusLabel ?? option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No integrations match the current filters.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Integration catalog with id, provider, status, freshness, sync times, and credential
                state. No stored secrets.
              </caption>
              <thead className="text-[var(--muted)]">
                <tr>
                  {[
                    "Integration",
                    "Provider",
                    "Status",
                    "Freshness",
                    "Last sync",
                    "Last success",
                    "Credential state",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-3 py-3 font-medium whitespace-nowrap"
                    >
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
                        className="inline-flex min-h-11 flex-col items-start justify-center text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      >
                        <span className="font-medium text-[var(--text)]">{item.name}</span>
                        <span className="text-xs text-[var(--muted)]">{item.id}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">{item.provider}</td>
                    <td className="px-3 py-3">
                      <StatusBadge label={item.statusLabel} tone={statusTone(item.status)} />
                      <span className="mt-1 block text-xs text-[var(--muted)]">{item.status}</span>
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      {item.freshnessLabel}
                      <span className="mt-1 block text-xs">{item.freshness}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                      {item.lastSyncAt}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                      {item.lastSuccessAt}
                    </td>
                    <td className="px-3 py-3 text-[var(--text)]">{item.credentialState}</td>
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
                  <span className="font-medium text-[var(--text)]">
                    {item.id} · {item.name}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {item.status} · {item.freshness}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-[var(--muted)]">
        Showing {filtered.length} of {integrations.length} stored records · Row selection opens
        record details
      </p>
    </div>
  );
}
