import { useState } from "react";

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
import { AssessmentWorkTable } from "@/features/governance/AssessmentWorkTable";
import { GovernanceSectionNav } from "@/features/governance/GovernanceSectionNav";
import { useGovernanceData } from "@/features/governance/useGovernanceData";
import type { GovernanceSectionId } from "@/types/governance";

export function GovernancePage() {
  const governance = useGovernanceData();
  const [section, setSection] = useState<GovernanceSectionId>("summary");

  return (
    <AppShell environmentLabel={governance.data.environmentLabel}>
      <PageContainer data-testid="governance-page">
        <PageHeader
          title="Governance & compliance"
          description="Manage control assurance, evidence, and review obligations."
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <Button
                type="button"
                disabled
                title="Assessment creation is not connected in this phase"
                aria-label="New assessment (not connected in this phase)"
              >
                New assessment
              </Button>
              <SimulatedDataBanner message={governance.data.snapshotLabel} />
            </div>
          }
        />

        <div className="mb-8">
          <GovernanceSectionNav active={section} onChange={setSection} />
        </div>

        {governance.state === "loading" ? <LoadingState label="Updating" rows={4} /> : null}

        {governance.state === "error" ? (
          <ErrorState
            title="Governance data unavailable"
            description="The simulated governance source failed to load. Retry to restore the last known demo snapshot."
            lastSuccessfulAt={governance.data.lastSuccessfulFetchAt}
            onRetry={governance.reload}
          />
        ) : null}

        {governance.state === "ready" ? (
          <div
            role="tabpanel"
            id={`governance-panel-${section}`}
            aria-labelledby={`governance-tab-${section}`}
            className="space-y-8"
          >
            {section === "summary" ? <SummarySection data={governance.data} /> : null}
            {section === "frameworks" ? <FrameworksSection data={governance.data} /> : null}
            {section === "controls" ? <ControlsSection data={governance.data} /> : null}
            {section === "evidence" ? <EvidenceSection data={governance.data} /> : null}
            {section === "policies" ? <PoliciesSection data={governance.data} /> : null}
            {section === "access-reviews" ? <AccessReviewsSection data={governance.data} /> : null}
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function SummarySection({ data }: { data: ReturnType<typeof useGovernanceData>["data"] }) {
  return (
    <>
      <section aria-labelledby="governance-summary-metrics-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="governance-summary-metrics-heading"
            className="font-heading text-xl font-bold text-[var(--text)]"
          >
            Assurance snapshot
          </h2>
          <StatusBadge label="SIMULATED" tone="warning" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((metric) => (
            <SummaryMetric key={metric.id} metric={metric} />
          ))}
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">
          Metrics are scoped independently. There is no aggregate security score.
        </p>
      </section>

      <Panel
        title="Assessment work"
        description="Open assessments and control reviews for the simulated AegisBridge Technologies program."
      >
        <AssessmentWorkTable assessments={data.assessments} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <Panel
          title="Evidence due"
          description="Collection items with the nearest due dates."
          className="h-full"
        >
          <ul className="space-y-3">
            {data.evidenceDue.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="leading-snug font-medium text-[var(--text)]">
                    {item.evidenceId} · {item.title}
                  </p>
                  <p className="text-xs leading-snug text-[var(--muted)]">
                    {item.linkedControlId} · {item.dueLabel}
                  </p>
                </div>
                <div className="shrink-0 pt-0.5">
                  <StatusBadge label={item.freshnessLabel} tone={item.statusTone} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Workflow & interpretation"
          description="How to read this simulated governance view."
          className="h-full"
        >
          <ul className="space-y-3">
            {data.interpretationNotes.map((note) => (
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

function FrameworksSection({ data }: { data: ReturnType<typeof useGovernanceData>["data"] }) {
  return (
    <section aria-labelledby="frameworks-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="frameworks-heading" className="font-heading text-xl font-bold text-[var(--text)]">
          Framework coverage
        </h2>
        <StatusBadge label="SIMULATED" tone="warning" />
      </div>
      <p className="text-sm text-[var(--muted)]">
        Coverage counts are scoped per framework. Mappings do not imply certification or an
        aggregate security score.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.frameworks.map((framework) => (
          <article
            key={framework.id}
            className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--raised)] p-5"
            data-testid="framework-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg text-[var(--text)]">
                  {framework.name} <span className="text-[var(--accent)]">{framework.version}</span>
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{framework.role}</p>
              </div>
              <p className="font-heading text-2xl font-bold text-[var(--accent)]">
                {framework.coveredCount} / {framework.totalInScope}
              </p>
            </div>
            <dl className="mt-4 grid gap-2 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Current</dt>
                <dd className="text-[var(--text)]">{framework.currentProfileLabel}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Target</dt>
                <dd className="text-[var(--text)]">{framework.targetProfileLabel}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{framework.notes}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ControlsSection({ data }: { data: ReturnType<typeof useGovernanceData>["data"] }) {
  return (
    <Panel
      title="Control implementation status"
      description="Identifiers, owners, and fictional implementation summaries. CIS entries store IDs only."
      action={<StatusBadge label="SIMULATED" tone="warning" />}
    >
      <ul className="space-y-3" data-testid="controls-list">
        {data.controls.map((control) => (
          <li
            key={control.id}
            className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-[var(--text)]">
                  <span className="text-[var(--accent)]">{control.controlId}</span> ·{" "}
                  {control.title}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {control.framework} · Owner {control.owner} · Evidence {control.evidenceCount} ·{" "}
                  {control.testFrequency}
                </p>
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  {control.implementationSummary}
                </p>
              </div>
              <StatusBadge label={control.status} tone={control.statusTone} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-[var(--muted)]">
        Status labels are textual. There is no aggregate security score.
      </p>
    </Panel>
  );
}

function EvidenceSection({ data }: { data: ReturnType<typeof useGovernanceData>["data"] }) {
  return (
    <Panel
      title="Evidence freshness"
      description="Collection and freshness state for control-linked evidence packages."
      action={<StatusBadge label="SIMULATED" tone="warning" />}
    >
      <ul className="space-y-3" data-testid="evidence-list">
        {data.evidence.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-[var(--text)]">
                {item.evidenceId} · {item.title}
              </p>
              <p className="text-xs text-[var(--muted)]">
                Linked control {item.linkedControlId} · {item.dueLabel}
              </p>
            </div>
            <StatusBadge label={item.freshnessLabel} tone={item.statusTone} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function PoliciesSection({ data }: { data: ReturnType<typeof useGovernanceData>["data"] }) {
  return (
    <Panel
      title="Policy status"
      description="Simulated policy catalog for AegisBridge Technologies with review cadence."
      action={<StatusBadge label="SIMULATED" tone="warning" />}
    >
      <ul className="space-y-3" data-testid="policies-list">
        {data.policies.map((policy) => (
          <li
            key={policy.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-[var(--text)]">
                {policy.name} <span className="text-[var(--muted)]">({policy.version})</span>
              </p>
              <p className="text-xs text-[var(--muted)]">
                Owner {policy.owner} · {policy.nextReviewLabel}
              </p>
            </div>
            <StatusBadge label={policy.reviewState} tone={policy.reviewTone} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function AccessReviewsSection({ data }: { data: ReturnType<typeof useGovernanceData>["data"] }) {
  return (
    <Panel
      title="Access review status"
      description="Campaign progress and fictional findings for the demo identity set."
      action={<StatusBadge label="SIMULATED" tone="warning" />}
    >
      <ul className="space-y-3" data-testid="access-reviews-list">
        {data.accessReviews.map((review) => (
          <li
            key={review.id}
            className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-[var(--text)]">{review.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {review.scope} · Owner {review.owner} · Decisions {review.decisionsCompleted} /{" "}
                  {review.decisionsTotal}
                </p>
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  {review.findingSummary}
                </p>
              </div>
              <StatusBadge label={review.statusLabel} tone={review.statusTone} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-[var(--muted)]">
        Decision completion rates are campaign metrics only — not an aggregate security score.
      </p>
    </Panel>
  );
}
