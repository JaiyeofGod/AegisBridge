import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status/StatusBadge";
import type { AssessmentRecord } from "@/types/governance";

export function AssessmentWorkTable({ assessments }: { assessments: AssessmentRecord[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const owners = useMemo(
    () => Array.from(new Set(assessments.map((item) => item.owner))).sort(),
    [assessments],
  );

  const statuses = useMemo(
    () => Array.from(new Set(assessments.map((item) => item.statusLabel))).sort(),
    [assessments],
  );

  const filtered = assessments.filter((item) => {
    const matchesQuery =
      query.trim().length === 0 ||
      `${item.name} ${item.frameworkScope} ${item.owner} ${item.statusLabel}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || item.statusLabel === statusFilter;
    const matchesOwner = ownerFilter === "all" || item.owner === ownerFilter;
    return matchesQuery && matchesStatus && matchesOwner;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[220px] flex-1">
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="assessment-search"
          >
            Search records
          </label>
          <input
            id="assessment-search"
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
            htmlFor="assessment-status"
          >
            Status
          </label>
          <select
            id="assessment-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-h-11 min-w-[160px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <option value="all">All</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="assessment-owner"
          >
            Owner
          </label>
          <select
            id="assessment-owner"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            className="min-h-11 min-w-[160px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <option value="all">All</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--raised)] text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Assessment / control
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Framework / scope
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
                  No control test results are stored for the current request.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{item.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{item.frameworkScope}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{item.owner}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={item.statusLabel} tone={item.statusTone} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Showing {filtered.length} of {assessments.length} development records · Row selection opens
        record details in a later phase
      </p>
    </div>
  );
}
