import { useMemo, useState } from "react";

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
import { impactLabel, likelihoodLabel, riskBand, riskScore } from "@/features/risk/risk-model";
import { RiskRegisterTable } from "@/features/risk/RiskRegisterTable";
import { RiskSectionNav } from "@/features/risk/RiskSectionNav";
import { useRiskData } from "@/features/risk/useRiskData";
import type { RiskRecord, RiskSectionId } from "@/types/risk";

export function RiskPage() {
  const risk = useRiskData();
  const [section, setSection] = useState<RiskSectionId>("register");
  const openRisks = risk.data.risks.filter((item) => item.open);
  const [selectedId, setSelectedId] = useState(
    openRisks.find((item) => item.riskId === "R-021")?.id ?? openRisks[0]?.id ?? "",
  );

  const selected = risk.data.risks.find((item) => item.id === selectedId) ?? openRisks[0];

  return (
    <AppShell environmentLabel={risk.data.environmentLabel}>
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
              <SimulatedDataBanner message={risk.data.snapshotLabel} />
            </div>
          }
        />

        <div className="mb-8">
          <RiskSectionNav active={section} onChange={setSection} />
        </div>

        {risk.state === "loading" ? <LoadingState label="Updating" rows={4} /> : null}
        {risk.state === "error" ? (
          <ErrorState
            title="Risk data unavailable"
            description="The simulated risk source failed to load. Retry to restore the last known demo snapshot."
            lastSuccessfulAt={risk.data.lastSuccessfulFetchAt}
            onRetry={risk.reload}
          />
        ) : null}

        {risk.state === "ready" ? (
          <div
            role="tabpanel"
            id={`risk-panel-${section}`}
            aria-labelledby={`risk-tab-${section}`}
            className="space-y-8"
          >
            {section === "register" ? (
              <RegisterSection
                metrics={risk.data.metrics}
                openRisks={openRisks}
                selected={selected}
                selectedId={selectedId}
                onSelect={setSelectedId}
                notes={risk.data.interpretationNotes}
              />
            ) : null}
            {section === "treatments" ? (
              <TreatmentsSection risks={risk.data.risks.filter((item) => item.open)} />
            ) : null}
            {section === "exceptions" ? (
              <ExceptionsSection risks={risk.data.risks.filter((item) => item.acceptedException)} />
            ) : null}
            {section === "vendors" ? (
              <VendorsSection risks={risk.data.risks.filter((item) => Boolean(item.vendorName))} />
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
  selected,
  selectedId,
  onSelect,
  notes,
}: {
  metrics: ReturnType<typeof useRiskData>["data"]["metrics"];
  openRisks: RiskRecord[];
  selected: RiskRecord | undefined;
  selectedId: string;
  onSelect: (id: string) => void;
  notes: string[];
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
          <StatusBadge label="SIMULATED" tone="warning" />
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

      <Panel
        title="Open risks"
        description="Residual ratings for the simulated AegisBridge Technologies register."
      >
        <RiskRegisterTable risks={openRisks} selectedId={selectedId} onSelect={onSelect} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <Panel
          title={selected ? `Selected risk · ${selected.riskId}` : "Selected risk"}
          description="Local selection only — record pages are not connected yet."
          className="h-full"
        >
          {selected ? <SelectedRisk risk={selected} /> : null}
        </Panel>
        <Panel
          title="Workflow & interpretation"
          description="How to read this simulated risk view."
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
  const residual = riskScore(risk.residualLikelihood, risk.residualImpact);
  const inherent = riskScore(risk.likelihood, risk.impact);
  const band = riskBand(residual);
  return (
    <dl className="space-y-4 text-sm">
      <div>
        <dt className="text-[var(--muted)]">Threat scenario</dt>
        <dd className="mt-1 text-[var(--text)]">{risk.scenario}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Business impact</dt>
        <dd className="mt-1 text-[var(--text)]">{risk.businessImpact}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Likelihood and impact</dt>
        <dd className="mt-1 text-[var(--text)]">
          Residual likelihood {risk.residualLikelihood} ({likelihoodLabel(risk.residualLikelihood)})
          · Residual impact {risk.residualImpact} ({impactLabel(risk.residualImpact)}) · Score{" "}
          {residual} ({band.label}). Inherent score {inherent}.
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Linked records</dt>
        <dd className="mt-1 text-[var(--text)]">{risk.linkedRecords}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Treatment</dt>
        <dd className="mt-1 text-[var(--text)]">
          {risk.treatment} · {risk.treatmentStatus}. {risk.treatmentDetail} Review due{" "}
          {risk.reviewDueLabel}.
        </dd>
      </div>
    </dl>
  );
}

function TreatmentsSection({ risks }: { risks: RiskRecord[] }) {
  const overdue = useMemo(() => risks.filter((item) => item.overdue), [risks]);
  return (
    <Panel
      title="Treatment plans"
      description="Mitigate, avoid, transfer, or accept. Overdue items stay visible as text."
      action={<StatusBadge label="SIMULATED" tone="warning" />}
    >
      <p className="mb-4 text-sm text-[var(--muted)]">{overdue.length} treatments are overdue.</p>
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
      <ul className="space-y-3" data-testid="exceptions-list">
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
      description="Fictional vendors only. No public vendor dossiers are stored here."
      action={<StatusBadge label="SIMULATED" tone="warning" />}
    >
      <ul className="space-y-3" data-testid="vendor-risks-list">
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
