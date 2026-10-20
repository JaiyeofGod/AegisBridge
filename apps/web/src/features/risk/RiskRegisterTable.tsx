import { StatusBadge } from "@/components/status/StatusBadge";
import { impactLabel, likelihoodLabel, riskBand } from "@/features/risk/risk-model";
import type { RiskRecord } from "@/types/risk";

export type RiskTableFilters = {
  search: string;
  riskLevel: string;
  treatmentStatus: string;
  owner: string;
};

export type RiskFilterOption = { value: string; label: string };

const selectClass =
  "min-h-11 min-w-[160px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function RiskRegisterTable({
  risks,
  total,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
  statusOptions,
  ownerOptions,
}: {
  risks: RiskRecord[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
  filters: RiskTableFilters;
  onFiltersChange: (filters: RiskTableFilters) => void;
  statusOptions: RiskFilterOption[];
  ownerOptions: RiskFilterOption[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[220px] flex-1">
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="risk-search"
          >
            Search records
          </label>
          <input
            id="risk-search"
            type="search"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search records…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--text)]" htmlFor="risk-level">
            Risk level
          </label>
          <select
            id="risk-level"
            className={selectClass}
            value={filters.riskLevel}
            onChange={(event) => onFiltersChange({ ...filters, riskLevel: event.target.value })}
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="risk-treatment"
          >
            Treatment status
          </label>
          <select
            id="risk-treatment"
            className={selectClass}
            value={filters.treatmentStatus}
            onChange={(event) =>
              onFiltersChange({ ...filters, treatmentStatus: event.target.value })
            }
          >
            <option value="all">All</option>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--text)]" htmlFor="risk-owner">
            Owner
          </label>
          <select
            id="risk-owner"
            className={selectClass}
            value={filters.owner}
            onChange={(event) => onFiltersChange({ ...filters, owner: event.target.value })}
          >
            <option value="all">All</option>
            {ownerOptions.map((name) => (
              <option key={name.value} value={name.value}>
                {name.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {risks.length === 0 ? (
          <p className="rounded-[var(--radius-control)] border border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
            No risks are stored for the current request.
          </p>
        ) : (
          risks.map((risk) => {
            const shown = shownAssessment(risk);
            const band = shown.score == null ? null : riskBand(shown.score);
            return (
              <button
                key={risk.id}
                type="button"
                onClick={() => onSelect(risk.id)}
                aria-pressed={selectedId === risk.id}
                className="flex min-h-11 w-full flex-col gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <span className="font-medium text-[var(--text)]">
                  {risk.riskId} · {risk.title}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {risk.affectedService} · {risk.owner}
                </span>
                <span className="text-sm text-[var(--text)]">
                  {shown.kind} likelihood {factorText(shown.likelihood, likelihoodLabel)} · Impact{" "}
                  {factorText(shown.impact, impactLabel)} · Score {shown.score ?? "Not recorded"}
                </span>
                <span className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={band?.label ?? "Not recorded"}
                    tone={band?.tone ?? "neutral"}
                  />
                  <StatusBadge
                    label={risk.treatmentStatus}
                    tone={risk.overdue ? "critical" : "neutral"}
                  />
                </span>
                <span className="text-xs text-[var(--muted)]">
                  Review due {risk.reviewDueLabel}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] md:block">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Open risks with likelihood, impact, and score kept separate. Residual values appear when
            stored; otherwise the inherent assessment is shown.
          </caption>
          <thead className="bg-[var(--raised)] text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Risk
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Affected service
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Owner
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Likelihood
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Impact
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Risk score
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Treatment
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Review due
              </th>
            </tr>
          </thead>
          <tbody>
            {risks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-[var(--muted)]">
                  No risks are stored for the current request.
                </td>
              </tr>
            ) : (
              risks.map((risk) => {
                const shown = shownAssessment(risk);
                const band = shown.score == null ? null : riskBand(shown.score);
                const selected = selectedId === risk.id;
                return (
                  <tr
                    key={risk.id}
                    className={
                      selected
                        ? "border-t border-[var(--border)] bg-[var(--raised)]"
                        : "border-t border-[var(--border)]"
                    }
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onSelect(risk.id)}
                        aria-pressed={selected}
                        className="inline-flex min-h-11 items-center text-left font-medium text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      >
                        {risk.riskId} · {risk.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{risk.affectedService}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{risk.owner}</td>
                    <td className="px-4 py-3 text-[var(--text)]">
                      {factorText(shown.likelihood, likelihoodLabel)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">
                      {factorText(shown.impact, impactLabel)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="mr-2 font-semibold text-[var(--text)]">
                        {shown.score ?? "—"}
                      </span>
                      <StatusBadge
                        label={band?.label ?? "Not recorded"}
                        tone={band?.tone ?? "neutral"}
                      />
                      <span className="mt-1 block text-xs text-[var(--muted)]">{shown.kind}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={`${band?.label ?? "Not recorded"} · ${risk.treatment}`}
                        tone={risk.overdue ? "critical" : (band?.tone ?? "neutral")}
                      />
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        {risk.treatmentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{risk.reviewDueLabel}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Showing {risks.length} of {total} development records · Row selection opens record details
      </p>
    </div>
  );
}

function shownAssessment(risk: RiskRecord) {
  const residual =
    risk.residualLikelihood != null && risk.residualImpact != null && risk.residualScore != null;
  if (residual) {
    return {
      kind: "Residual" as const,
      likelihood: risk.residualLikelihood,
      impact: risk.residualImpact,
      score: risk.residualScore ?? null,
    };
  }
  return {
    kind: "Inherent" as const,
    likelihood: risk.likelihood,
    impact: risk.impact,
    score: risk.score ?? null,
  };
}

function factorText(value: number | null, label: (value: number) => string) {
  if (value == null) return "Not recorded";
  return `${value} · ${label(value)}`;
}
