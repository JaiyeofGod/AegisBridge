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
import { StaleDataIndicator } from "@/components/status/StaleDataIndicator";
import { SEEDED_DATA_LABEL, SEEDED_DATA_NOTE } from "@/features/data-origin";
import { AssessmentWorkTable } from "@/features/governance/AssessmentWorkTable";
import { GovernanceSectionNav } from "@/features/governance/GovernanceSectionNav";
import { mapGovernanceSummary, type GovernanceView } from "@/features/governance/mapGovernance";
import { useGovernanceSummary } from "@/features/governance/useGovernanceData";
import { formatTimestamp } from "@/lib/format";
import type { GovernanceSectionId } from "@/types/governance";

export function GovernancePage() {
  const governance = useGovernanceSummary();
  const [section, setSection] = useState<GovernanceSectionId>("summary");
  const generatedAt = governance.dataUpdatedAt
    ? new Date(governance.dataUpdatedAt).toISOString()
    : new Date().toISOString();
  const view = governance.data ? mapGovernanceSummary(governance.data, generatedAt) : null;

  return (
    <AppShell environmentLabel="Development · Seeded">
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
              <SimulatedDataBanner message={SEEDED_DATA_NOTE} />
              {governance.dataUpdatedAt ? (
                <p className="text-xs text-[var(--muted)]" data-testid="last-successful-fetch">
                  Last successful update: {formatTimestamp(generatedAt)}
                </p>
              ) : null}
            </div>
          }
        />

        <div className="mb-8">
          <GovernanceSectionNav active={section} onChange={setSection} />
        </div>

        {governance.isPending ? <LoadingState label="Updating" rows={4} /> : null}

        {governance.isError ? (
          <ErrorState
            title="Governance data unavailable"
            description="The development governance API did not respond. Retry to load the seeded summary. Fixture counts are not substituted."
            lastSuccessfulAt={governance.dataUpdatedAt ? generatedAt : undefined}
            onRetry={() => void governance.refetch()}
          />
        ) : null}

        {governance.isSuccess && governance.isFetching ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development governance summary"
              lastSuccessfulAt={generatedAt}
            />
          </div>
        ) : null}

        {governance.isSuccess && view ? (
          <div
            role="tabpanel"
            id={`governance-panel-${section}`}
            aria-labelledby={`governance-tab-${section}`}
            className="space-y-8"
          >
            {section === "summary" ? <SummarySection data={view} /> : null}
            {section === "frameworks" ? <FrameworksSection data={view} /> : null}
            {section === "controls" ? <ControlsSection data={view} /> : null}
            {section === "evidence" ? <EvidenceSection data={view} /> : null}
            {section === "policies" ? <PoliciesSection data={view} /> : null}
            {section === "access-reviews" ? <AccessReviewsSection data={view} /> : null}
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function SummarySection({ data }: { data: GovernanceView }) {
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
          <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
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
        description="Control test results returned by the governance summary."
      >
        {data.assessments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No control test results stored.</p>
        ) : (
          <AssessmentWorkTable assessments={data.assessments} />
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <Panel
          title="Evidence due"
          description="Due dates are not stored. Freshness uses collected_at and SHA-256 metadata."
          className="h-full"
        >
          <p className="text-sm text-[var(--muted)]">No evidence due dates are stored.</p>
        </Panel>

        <Panel
          title="Workflow & interpretation"
          description="How to read this development governance summary."
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

function FrameworksSection({ data }: { data: GovernanceView }) {
  return (
    <section aria-labelledby="frameworks-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="frameworks-heading" className="font-heading text-xl font-bold text-[var(--text)]">
          Framework coverage
        </h2>
        <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
      </div>
      <p className="text-sm text-[var(--muted)]">
        Coverage counts are scoped per framework. Mappings do not imply certification or an
        aggregate security score.
      </p>
      <p className="text-sm text-[var(--muted)]">
        NIST CSF 2.0, CIS Controls v8.1, and OWASP ASVS 5.0.0 appear here only when the summary
        returns them.
      </p>
      {data.frameworks.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No frameworks are stored.</p>
      ) : null}
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
              <p className="text-right">
                <span className="font-heading text-2xl font-bold text-[var(--accent)]">
                  {framework.storedControlCount}
                </span>
                <span className="mt-1 block text-xs text-[var(--muted)]">Stored controls</span>
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

function ControlsSection({ data }: { data: GovernanceView }) {
  return (
    <Panel
      title="Control implementation status"
      description="Status counts returned by the summary. CIS entries, when stored, are identifiers and status only."
      action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
    >
      <ul className="space-y-3" data-testid="controls-list">
        {data.statusCounts.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">
            No control implementation status is stored.
          </li>
        ) : (
          data.statusCounts.map((item) => (
            <li
              key={item.status}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
            >
              <p className="font-medium text-[var(--text)]">{item.status}</p>
              <p className="text-sm text-[var(--muted)]">{item.count}</p>
            </li>
          ))
        )}
        <li className="text-sm text-[var(--muted)]">
          {data.testsRecorded === 0
            ? "No control test results stored."
            : `${data.testsPassed} passed of ${data.testsRecorded} stored control tests.`}
        </li>
      </ul>
      <p className="mt-4 text-xs text-[var(--muted)]">
        {data.assessedApplicable} assessed applicable. Status labels are textual. There is no
        aggregate security score.
      </p>
    </Panel>
  );
}

function EvidenceSection({ data }: { data: GovernanceView }) {
  const freshness = data.evidence;
  return (
    <Panel
      title="Evidence freshness"
      description="Stored evidence metadata. Automated evidence collection is not connected."
      action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
    >
      <ul className="space-y-3" data-testid="evidence-list">
        {freshness.recorded === 0 ? (
          <li className="text-sm text-[var(--muted)]">No evidence freshness data is stored.</li>
        ) : (
          <>
            <li className="text-sm text-[var(--text)]">Recorded evidence: {freshness.recorded}</li>
            <li className="text-sm text-[var(--text)]">With SHA-256: {freshness.with_sha256}</li>
            <li className="text-sm text-[var(--text)]">
              Missing collected_at: {freshness.missing_collected_at}
            </li>
            <li className="text-sm text-[var(--muted)]">{freshness.semantics}</li>
            <li className="text-sm text-[var(--muted)]">No evidence due dates are stored.</li>
          </>
        )}
      </ul>
    </Panel>
  );
}

function PoliciesSection({ data }: { data: GovernanceView }) {
  return (
    <Panel
      title="Policy status"
      description="Policy records returned by the governance summary. Review dates are not stored."
      action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
    >
      <ul className="space-y-3" data-testid="policies-list">
        {data.policies.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">No policy records are stored.</li>
        ) : (
          data.policies.map((policy) => (
            <li
              key={policy.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-[var(--text)]">
                  {policy.id} · {policy.title}{" "}
                  <span className="text-[var(--muted)]">({policy.version})</span>
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Owner {policy.owner} · Acknowledgements {policy.acknowledgementCount} · Next
                  review Not stored
                </p>
              </div>
              <StatusBadge label={policy.statusLabel} tone={policy.statusTone} />
            </li>
          ))
        )}
      </ul>
    </Panel>
  );
}

function AccessReviewsSection({ data }: { data: GovernanceView }) {
  return (
    <Panel
      title="Access review status"
      description="Review records returned by the summary. A directory connection is not implied."
      action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
    >
      <ul className="space-y-3" data-testid="access-reviews-list">
        {data.accessReviews.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">No access reviews are stored.</li>
        ) : (
          data.accessReviews.map((review) => (
            <li
              key={review.id}
              className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-[var(--text)]">
                    {review.id} · {review.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Open findings {review.openFindings} / {review.totalFindings}. Scope and owner
                    are not stored.
                  </p>
                </div>
                <StatusBadge label={review.statusLabel} tone={review.statusTone} />
              </div>
            </li>
          ))
        )}
      </ul>
      <p className="mt-4 text-xs text-[var(--muted)]">
        Finding counts are campaign records only. There is no aggregate security score.
      </p>
    </Panel>
  );
}
