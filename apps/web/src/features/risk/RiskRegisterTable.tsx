import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status/StatusBadge";
import { impactLabel, likelihoodLabel, riskBand, riskScore } from "@/features/risk/risk-model";
import type { RiskRecord } from "@/types/risk";

const selectClass =
  "min-h-11 min-w-[160px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function RiskRegisterTable({
  risks,
  selectedId,
  onSelect,
}: {
  risks: RiskRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [treatmentStatus, setTreatmentStatus] = useState("all");
  const [owner, setOwner] = useState("all");

  const owners = useMemo(
    () => Array.from(new Set(risks.map((risk) => risk.owner))).sort(),
    [risks],
  );
  const statuses = useMemo(
    () => Array.from(new Set(risks.map((risk) => risk.treatmentStatus))).sort(),
    [risks],
  );

  const filtered = risks.filter((risk) => {
    const residual = riskScore(risk.residualLikelihood, risk.residualImpact);
    const band = riskBand(residual).label;
    const haystack =
      `${risk.riskId} ${risk.title} ${risk.affectedService} ${risk.owner} ${risk.treatment} ${band}`.toLowerCase();
    const matchesQuery = query.trim().length === 0 || haystack.includes(query.trim().toLowerCase());
    const matchesLevel = level === "all" || band === level;
    const matchesStatus = treatmentStatus === "all" || risk.treatmentStatus === treatmentStatus;
    const matchesOwner = owner === "all" || risk.owner === owner;
    return matchesQuery && matchesLevel && matchesStatus && matchesOwner;
  });

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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="all">All</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
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
            value={treatmentStatus}
            onChange={(event) => setTreatmentStatus(event.target.value)}
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
          <label className="mb-2 block text-sm font-medium text-[var(--text)]" htmlFor="risk-owner">
            Owner
          </label>
          <select
            id="risk-owner"
            className={selectClass}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          >
            <option value="all">All</option>
            {owners.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-[var(--radius-control)] border border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
            No risks match the current filters. Clear filters to see the sample register.
          </p>
        ) : (
          filtered.map((risk) => {
            const score = riskScore(risk.residualLikelihood, risk.residualImpact);
            const band = riskBand(score);
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
                  Likelihood {risk.residualLikelihood} ({likelihoodLabel(risk.residualLikelihood)})
                  · Impact {risk.residualImpact} ({impactLabel(risk.residualImpact)}) · Score{" "}
                  {score}
                </span>
                <span className="flex flex-wrap gap-2">
                  <StatusBadge label={band.label} tone={band.tone} />
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
            Open risks with residual likelihood, impact, score, treatment, and review date. Score is
            likelihood times impact.
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-[var(--muted)]">
                  No risks match the current filters. Clear filters to see the sample register.
                </td>
              </tr>
            ) : (
              filtered.map((risk) => {
                const score = riskScore(risk.residualLikelihood, risk.residualImpact);
                const band = riskBand(score);
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
                      {risk.residualLikelihood} · {likelihoodLabel(risk.residualLikelihood)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">
                      {risk.residualImpact} · {impactLabel(risk.residualImpact)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="mr-2 font-semibold text-[var(--text)]">{score}</span>
                      <StatusBadge label={band.label} tone={band.tone} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={`${band.label} · ${risk.treatment}`}
                        tone={risk.overdue ? "critical" : band.tone}
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
        Showing {filtered.length} of {risks.length} sample records · Row selection opens record
        details
      </p>
    </div>
  );
}
