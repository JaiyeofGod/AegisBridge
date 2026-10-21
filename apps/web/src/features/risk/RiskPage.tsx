import { useDeferredValue, useMemo, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { SummaryMetric } from "@/components/cards/SummaryMetric";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { SimulatedDataBanner } from "@/components/feedback/SimulatedDataBanner";
import { AppShell } from "@/components/navigation/AppShell";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StatusBadge } from "@/components/status/StatusBadge";
import { StaleDataIndicator } from "@/components/status/StaleDataIndicator";
import { SEEDED_DATA_LABEL, SEEDED_DATA_NOTE } from "@/features/data-origin";
import { mapRiskInventory } from "@/features/risk/mapRisk";
import { impactLabel, likelihoodLabel, riskBand } from "@/features/risk/risk-model";
import { RiskTreatmentEditor } from "@/features/risk/RiskTreatmentEditor";
import { RiskRegisterTable, type RiskTableFilters } from "@/features/risk/RiskRegisterTable";
import { RiskSectionNav } from "@/features/risk/RiskSectionNav";
import { useRiskCatalog, useRiskDetail, useRiskList } from "@/features/risk/useRiskData";
import { useAuthStatus } from "@/features/auth/useAuthSession";
import { formatTimestamp } from "@/lib/format";
import type { RiskQuery } from "@/services/api-types";
import type { OverviewMetric } from "@/types/overview";
import type { RiskRecord, RiskSectionId } from "@/types/risk";

const emptyFilters: RiskTableFilters = {
  search: "",
  riskLevel: "all",
  treatmentStatus: "all",
  owner: "all",
};

export function RiskPage() {
  const catalog = useRiskCatalog();
  const [section, setSection] = useState<RiskSectionId>("register");
  const [selectedId, setSelectedId] = useState("");
  const [filters, setFilters] = useState<RiskTableFilters>(emptyFilters);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const query = useMemo(
    () => toRiskQuery({ ...filters, search: deferredSearch }),
    [filters, deferredSearch],
  );
  const hasServerFilters = Object.values(query).length > 0;
  const filtered = useRiskList(query, hasServerFilters);
  const generatedAt = catalog.dataUpdatedAt
    ? new Date(catalog.dataUpdatedAt).toISOString()
    : new Date().toISOString();
  const sourceItems = hasServerFilters ? (filtered.data?.items ?? []) : (catalog.data?.items ?? []);
  const snapshot = catalog.data ? mapRiskInventory(catalog.data.items, generatedAt) : null;
  const visible = catalog.data ? mapRiskInventory(sourceItems, generatedAt).risks : [];
  const openRisks = visible.filter((item) => item.open);
  const selectedRow = visible.find((item) => item.id === selectedId) ?? visible[0];
  const detail = useRiskDetail(selectedRow?.riskId ?? "");
  const selected = detail.data ?? selectedRow;
  const statusOptions = uniqueOptions(
    catalog.data?.items
      .map((item) => item.treatment_status)
      .filter((value): value is string => Boolean(value)) ?? [],
  );
  const ownerOptions = uniqueOptions(
    catalog.data?.items
      .map((item) => item.owner?.display_name)
      .filter((value): value is string => Boolean(value)) ?? [],
  );

  return (
    <AppShell environmentLabel="Development · Seeded">
      <PageContainer data-testid="risks-page">
        <PageHeader
          title="Risk register"
          description="Track business impact, ownership, and treatment decisions."
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <Button
                type="button"
                disabled
                title="Risk creation is not connected in this phase"
                aria-label="Create risk (not connected in this phase)"
              >
                Create risk
              </Button>
              <SimulatedDataBanner message={SEEDED_DATA_NOTE} />
              {catalog.dataUpdatedAt ? (
                <p className="text-xs text-[var(--muted)]" data-testid="last-successful-fetch">
                  Last successful update: {formatTimestamp(generatedAt)}
                </p>
              ) : null}
            </div>
          }
        />

        <div className="mb-8">
          <RiskSectionNav active={section} onChange={setSection} />
        </div>

        {catalog.isPending ? <LoadingState label="Updating" rows={4} /> : null}
        {catalog.isError ? (
          <ErrorState
            title="Risk data unavailable"
            description="The development risk API did not respond. Retry to load the seeded register. Fixture counts are not substituted."
            onRetry={() => void catalog.refetch()}
          />
        ) : null}
        {filtered.isError ? (
          <ErrorState
            title="Filtered risk register unavailable"
            description="The risk filter request failed. Fixture rows are not added."
            onRetry={() => void filtered.refetch()}
          />
        ) : null}
        {catalog.isSuccess && (catalog.isFetching || filtered.isFetching || detail.isFetching) ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development risk register"
              lastSuccessfulAt={generatedAt}
            />
          </div>
        ) : null}

        {catalog.isSuccess && snapshot ? (
          <div
            role="tabpanel"
            id={`risk-panel-${section}`}
            aria-labelledby={`risk-tab-${section}`}
            className="space-y-8"
          >
            {section === "register" ? (
              <RegisterSection
                metrics={snapshot.metrics}
                openRisks={openRisks}
                total={
                  hasServerFilters ? (filtered.data?.total ?? openRisks.length) : catalog.data.total
                }
                selected={selected}
                selectedId={selected?.id ?? ""}
                onSelect={setSelectedId}
                notes={snapshot.interpretationNotes}
                filters={filters}
                onFiltersChange={setFilters}
                statusOptions={statusOptions}
                ownerOptions={ownerOptions}
              />
            ) : null}
            {section === "treatments" ? (
              <TreatmentsSection
                risks={visible.filter((item) => item.treatment !== "Not recorded")}
              />
            ) : null}
            {section === "exceptions" ? (
              <ExceptionsSection risks={visible.filter((item) => item.acceptedException)} />
            ) : null}
            {section === "vendors" ? (
              <VendorsSection risks={visible.filter((item) => Boolean(item.vendorName))} />
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function RegisterSection({
  metrics,
  openRisks,
  total,
  selected,
  selectedId,
  onSelect,
  notes,
  filters,
  onFiltersChange,
  statusOptions,
  ownerOptions,
}: {
  metrics: OverviewMetric[];
  openRisks: RiskRecord[];
  total: number;
  selected: RiskRecord | undefined;
  selectedId: string;
  onSelect: (id: string) => void;
  notes: string[];
  filters: RiskTableFilters;
  onFiltersChange: (filters: RiskTableFilters) => void;
  statusOptions: { value: string; label: string }[];
  ownerOptions: { value: string; label: string }[];
}) {
  return (
    <>
      <section aria-labelledby="risk-summary-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="risk-summary-heading"
            className="font-heading text-xl font-bold text-[var(--text)]"
          >
            Open-risk summary
          </h2>
          <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <SummaryMetric key={metric.id} metric={metric} />
          ))}
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">
          Ratings use an internal likelihood × impact method. There is no aggregate security score.
        </p>
      </section>

      <Panel title="Open risks" description="Development records returned by the risk API.">
        <RiskRegisterTable
          risks={openRisks}
          total={total}
          selectedId={selectedId}
          onSelect={onSelect}
          filters={filters}
          onFiltersChange={onFiltersChange}
          statusOptions={statusOptions}
          ownerOptions={ownerOptions}
        />
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <Panel
          title={selected ? `Selected risk · ${selected.riskId}` : "Selected risk"}
          description="Stored likelihood, impact, and score. Related modules stay closed."
          className="h-full"
        >
          {selected ? <SelectedRisk risk={selected} /> : null}
        </Panel>
        <Panel
          title="Workflow & interpretation"
          description="How to read this development risk view."
          className="h-full"
        >
          <ul className="space-y-3">
            {notes.map((note) => (
              <li
                key={note}
                className="rounded-[var(--radius-control)] bg-[var(--raised)] px-3 py-3 text-sm leading-relaxed text-[var(--muted)]"
              >
                {note}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function SelectedRisk({ risk }: { risk: RiskRecord }) {
  const auth = useAuthStatus();
  const canManage = auth.user?.permissions.includes("risk.manage") === true;
  const inherent =
    risk.likelihood != null && risk.impact != null ? risk.likelihood * risk.impact : risk.score;
  const residual =
    risk.residualLikelihood != null && risk.residualImpact != null
      ? risk.residualLikelihood * risk.residualImpact
      : risk.residualScore;
  const band = inherent == null ? null : riskBand(inherent);
  return (
    <dl className="space-y-4 text-sm">
      <div>
        <dt className="text-[var(--muted)]">Threat scenario</dt>
        <dd className="mt-1 text-[var(--text)]">{risk.scenario}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Methodology</dt>
        <dd className="mt-1 text-[var(--text)]">
          {risk.methodologyLabel ??
            "Score is likelihood × impact. This is an AegisBridge internal method, not a NIST formula."}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Likelihood and impact</dt>
        <dd className="mt-1 text-[var(--text)]">
          Inherent likelihood {factorText(risk.likelihood, likelihoodLabel)} · Inherent impact{" "}
          {factorText(risk.impact, impactLabel)} · Score {inherent ?? "Not recorded"}
          {band ? ` (${band.label})` : ""}. Residual likelihood{" "}
          {factorText(risk.residualLikelihood, likelihoodLabel)} · Residual impact{" "}
          {factorText(risk.residualImpact, impactLabel)} · Residual score{" "}
          {residual ?? "Not recorded"}.
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Linked records</dt>
        <dd className="mt-1 text-[var(--text)]">{risk.linkedRecords}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Treatment</dt>
        <dd className="mt-1 text-[var(--text)]">
          <RiskTreatmentEditor
            riskId={risk.riskId}
            strategy={risk.treatmentStrategyRaw ?? null}
            status={risk.treatmentStatusRaw ?? null}
            notes={risk.treatmentNotesRaw ?? null}
            updatedAt={risk.treatmentUpdatedAt ?? null}
            readOnly={!canManage}
          />
          <p className="mt-2 text-xs text-[var(--muted)]">Review {risk.reviewDueLabel}.</p>
        </dd>
      </div>
    </dl>
  );
}

function factorText(value: number | null, label: (value: number) => string) {
  if (value == null) return "Not recorded";
  return `${value} (${label(value)})`;
}

function toRiskQuery(filters: RiskTableFilters): RiskQuery {
  return {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.riskLevel !== "all" ? { riskLevel: filters.riskLevel } : {}),
    ...(filters.treatmentStatus !== "all" ? { treatmentStatus: filters.treatmentStatus } : {}),
    ...(filters.owner !== "all" ? { owner: filters.owner } : {}),
  };
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values))
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      value,
      label: value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    }));
}

function TreatmentsSection({ risks }: { risks: RiskRecord[] }) {
  const overdue = useMemo(() => risks.filter((item) => item.overdue), [risks]);
  return (
    <Panel
      title="Treatment plans"
      description="Mitigate, avoid, transfer, or accept. Overdue items stay visible as text."
      action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
    >
      <p className="mb-4 text-sm text-[var(--muted)]">
        Treatment due dates are not stored, so overdue treatments are not counted.
        {overdue.length > 0 ? ` ${overdue.length} stored records are marked overdue.` : ""}
      </p>
      {risks.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No treatment records are stored.</p>
      ) : null}
      <ul className="space-y-3" data-testid="treatments-list">
        {risks.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-[var(--text)]">
                {item.riskId} · {item.title}
              </p>
              <p className="text-sm text-[var(--muted)]">{item.treatmentDetail}</p>
              <p className="text-xs text-[var(--muted)]">
                Owner {item.owner} · Review due {item.reviewDueLabel}
              </p>
            </div>
            <StatusBadge
              label={`${item.treatment} · ${item.treatmentStatus}`}
              tone={item.overdue ? "critical" : "accent"}
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ExceptionsSection({ risks }: { risks: RiskRecord[] }) {
  return (
    <Panel
      title="Accepted exceptions"
      description="Time-boxed acceptances with rationale. These are excluded from the open-risk count."
      action={<StatusBadge label={`${risks.length} accepted`} tone="warning" />}
    >
      {risks.length === 0 ? (
        <p className="text-sm text-[var(--muted)]" data-testid="exceptions-list">
          No accepted exceptions are stored.
        </p>
      ) : null}
      <ul className="space-y-3">
        {risks.map((item) => (
          <li
            key={item.id}
            className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium text-[var(--text)]">
                  {item.riskId} · {item.title}
                </p>
                <p className="text-sm text-[var(--muted)]">{item.treatmentDetail}</p>
                <p className="text-xs text-[var(--muted)]">
                  Expires / review {item.reviewDueLabel}
                </p>
              </div>
              <StatusBadge label="Accepted exception" tone="warning" />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function VendorsSection({ risks }: { risks: RiskRecord[] }) {
  return (
    <Panel
      title="Vendor-linked risks"
      description="Vendor links are shown only when the risk API returns them."
      action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
    >
      {risks.length === 0 ? (
        <p className="text-sm text-[var(--muted)]" data-testid="vendor-risks-list">
          No vendor links are stored.
        </p>
      ) : null}
      <ul className="space-y-3">
        {risks.map((item) => (
          <li
            key={item.id}
            className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
          >
            <p className="font-medium text-[var(--text)]">
              {item.vendorName} · {item.riskId}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{item.scenario}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Owner {item.owner} · {item.treatment} · Review {item.reviewDueLabel}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
