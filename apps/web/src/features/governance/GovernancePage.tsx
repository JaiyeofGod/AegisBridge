import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { SummaryMetric } from "@/components/cards/SummaryMetric";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { SimulatedDataBanner } from "@/components/feedback/SimulatedDataBanner";
import { AppShell } from "@/components/navigation/AppShell";
import { CatalogPager } from "@/components/navigation/CatalogPager";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StatusBadge } from "@/components/status/StatusBadge";
import { StaleDataIndicator } from "@/components/status/StaleDataIndicator";
import { useAuthStatus } from "@/features/auth/useAuthSession";
import { SEEDED_DATA_LABEL, SEEDED_DATA_NOTE } from "@/features/data-origin";
import { AssessmentWorkTable } from "@/features/governance/AssessmentWorkTable";
import {
  CONTROL_IMPLEMENTATION_STATUSES,
  CONTROL_PAGE_SIZE,
  CONTROL_SORT_OPTIONS,
  SORT_DIRECTIONS,
  totalPages,
} from "@/features/governance/catalogConstants";
import { ControlEvidencePanel } from "@/features/governance/ControlEvidencePanel";
import { ControlImplementationEditor } from "@/features/governance/ControlImplementationEditor";
import { ControlTestPanel } from "@/features/governance/ControlTestPanel";
import { GovernanceSectionNav } from "@/features/governance/GovernanceSectionNav";
import { mapGovernanceSummary, type GovernanceView } from "@/features/governance/mapGovernance";
import { PolicyManagementPanel } from "@/features/governance/PolicyManagementPanel";
import {
  useGovernanceControl,
  useGovernanceControls,
  useGovernanceSummary,
} from "@/features/governance/useGovernanceData";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { ApiError } from "@/services/api-client";
import type {
  ControlImplementationStatusValue,
  ControlListQuery,
  ControlSortKey,
  SortDirection,
} from "@/services/api-types";
import type { GovernanceSectionId } from "@/types/governance";

export function GovernancePage() {
  const auth = useAuthStatus();
  const permissions = auth.user?.permissions ?? [];
  const canManageControls = permissions.includes("control.manage");
  const canReadEvidence = permissions.includes("evidence.read");
  const canManageEvidence = permissions.includes("evidence.manage");
  const canLinkEvidence = canManageControls && canManageEvidence;
  const canReadPolicies = permissions.includes("policy.read");
  const canManagePolicies = permissions.includes("policy.manage");
  const canApprovePolicies = permissions.includes("policy.approve");
  const governance = useGovernanceSummary();
  const [section, setSection] = useState<GovernanceSectionId>("summary");
  const [focusControlId, setFocusControlId] = useState<string | null>(null);
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
            {section === "controls" ? (
              <ControlsSection
                data={view}
                canManageControls={canManageControls}
                canReadEvidence={canReadEvidence}
                canManageEvidence={canManageEvidence}
                canLinkEvidence={canLinkEvidence}
                initialControlId={focusControlId}
                onControlFocused={() => setFocusControlId(null)}
              />
            ) : null}
            {section === "evidence" ? <EvidenceSection data={view} /> : null}
            {section === "policies" ? (
              <PolicyManagementPanel
                canRead={canReadPolicies}
                canManage={canManagePolicies}
                canApprove={canApprovePolicies}
                onOpenControl={(controlId) => {
                  setFocusControlId(controlId);
                  setSection("controls");
                }}
              />
            ) : null}
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

function ControlsSection({
  data,
  canManageControls,
  canReadEvidence,
  canManageEvidence,
  canLinkEvidence,
  initialControlId,
  onControlFocused,
}: {
  data: GovernanceView;
  canManageControls: boolean;
  canReadEvidence: boolean;
  canManageEvidence: boolean;
  canLinkEvidence: boolean;
  initialControlId?: string | null;
  onControlFocused?: () => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [framework, setFramework] = useState("");
  const [implementationStatus, setImplementationStatus] = useState<
    ControlImplementationStatusValue | ""
  >("");
  const [sort, setSort] = useState<ControlSortKey>("id");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");

  const listQuery = useMemo<ControlListQuery>(
    () => ({
      page,
      pageSize: CONTROL_PAGE_SIZE,
      q: debouncedSearch.trim() || undefined,
      framework: framework || undefined,
      implementationStatus: implementationStatus || undefined,
      sort,
      direction,
    }),
    [page, debouncedSearch, framework, implementationStatus, sort, direction],
  );

  const hasCatalogFilters = Boolean(debouncedSearch.trim() || framework || implementationStatus);

  const controls = useGovernanceControls(listQuery);
  const items = controls.data?.items ?? [];
  const total = controls.data?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, framework, implementationStatus, sort, direction]);

  useEffect(() => {
    if (!controls.data) return;
    const pages = totalPages(controls.data.total, CONTROL_PAGE_SIZE);
    if (page > pages) setPage(pages);
  }, [controls.data, page]);

  const activeId = selectedId || items[0]?.id || "";
  const detail = useGovernanceControl(activeId || null);

  useEffect(() => {
    if (!initialControlId) return;
    setSelectedId(initialControlId);
    setSearchInput(initialControlId);
    onControlFocused?.();
    // Clear focus once applied; parent callback identity is intentionally ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focus once per initialControlId
  }, [initialControlId]);

  const frameworkOptions = data.frameworks.map((item) => ({
    value: item.code,
    label: `${item.code}${item.version ? ` ${item.version}` : ""}`,
  }));

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Panel
          title="Controls"
          description="Server-side search and pagination. Licensed CIS text is not included."
        >
          <div className="mb-3 space-y-2" data-testid="controls-catalog-filters">
            <label className="block text-xs text-[var(--muted)]">
              Search controls
              <div className="mt-1 flex gap-2">
                <input
                  className="block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Id, code, title, framework…"
                  data-testid="controls-catalog-search"
                />
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="controls-catalog-search-clear"
                  aria-label="Clear control search"
                  disabled={searchInput.length === 0}
                  onClick={() => setSearchInput("")}
                >
                  Clear
                </Button>
              </div>
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Framework
              <select
                className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                value={framework}
                onChange={(event) => setFramework(event.target.value)}
                data-testid="controls-catalog-framework"
              >
                <option value="">All frameworks</option>
                {frameworkOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Implementation status
              <select
                className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                value={implementationStatus}
                onChange={(event) =>
                  setImplementationStatus(
                    event.target.value as ControlImplementationStatusValue | "",
                  )
                }
                data-testid="controls-catalog-status"
              >
                <option value="">All statuses</option>
                {CONTROL_IMPLEMENTATION_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-[var(--muted)]">
                Sort
                <select
                  className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as ControlSortKey)}
                  data-testid="controls-catalog-sort"
                  aria-label="Sort controls"
                >
                  {CONTROL_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Direction
                <select
                  className="mt-1 block w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text)]"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value as SortDirection)}
                  data-testid="controls-catalog-direction"
                  aria-label="Sort direction"
                >
                  {SORT_DIRECTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {controls.isPending && !controls.data ? (
            <LoadingState label="Loading controls" rows={3} />
          ) : null}
          {controls.isError ? (
            <ErrorState
              title="Controls unavailable"
              description={
                controls.error instanceof ApiError && controls.error.status === 422
                  ? "Control catalog query parameters were rejected."
                  : controls.error instanceof ApiError && controls.error.status === 403
                    ? "You do not have permission to read the control catalog."
                    : "The control list could not be loaded."
              }
              onRetry={() => void controls.refetch()}
            />
          ) : null}
          {controls.isSuccess || controls.data ? (
            <>
              {controls.isFetching ? (
                <p
                  className="mb-2 text-xs text-[var(--muted)]"
                  data-testid="controls-catalog-updating"
                >
                  Updating results…
                </p>
              ) : null}
              <ul className="space-y-2" data-testid="governance-control-catalog">
                {items.length === 0 ? (
                  <li className="text-sm text-[var(--muted)]" data-testid="controls-catalog-empty">
                    {hasCatalogFilters
                      ? "No controls match the current search or filters."
                      : "No controls are available."}
                  </li>
                ) : (
                  items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-[var(--radius-control)] border px-3 py-3 text-left transition",
                          item.id === activeId
                            ? "border-[var(--accent)] bg-[var(--raised)]"
                            : "border-[var(--border)] bg-[var(--canvas)] hover:border-[var(--accent)]",
                        )}
                        data-testid={`governance-control-${item.id}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <p className="text-sm font-medium text-[var(--text)]">
                          {item.id} · {item.control_code}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{item.title}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {(item.implementation_status ?? "not stored").replaceAll("_", " ")} ·{" "}
                          {item.test_count} tests · {item.evidence_count} evidence
                        </p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <CatalogPager
                page={page}
                pageSize={CONTROL_PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                label="controls"
                testIdPrefix="controls-catalog-pager"
              />
            </>
          ) : null}
        </Panel>

        <div className="space-y-4">
          {!activeId ? (
            <Panel title="Control detail" description="Select a control to continue.">
              <p className="text-sm text-[var(--muted)]">No control selected.</p>
            </Panel>
          ) : (
            <>
              {detail.isPending ? <LoadingState label="Loading control" rows={4} /> : null}
              {detail.isError ? (
                <ErrorState
                  title="Control unavailable"
                  description="The selected control could not be loaded."
                  onRetry={() => void detail.refetch()}
                />
              ) : null}
              {detail.isSuccess && detail.data ? (
                <>
                  <Panel
                    title={`${detail.data.id} · ${detail.data.control_code}`}
                    description={detail.data.title}
                    action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
                  >
                    <dl className="grid gap-2 text-sm">
                      <div>
                        <dt className="text-[var(--muted)]">Framework</dt>
                        <dd className="text-[var(--text)]">
                          {detail.data.framework_code ?? "Not stored"}{" "}
                          {detail.data.framework_version ?? ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Family</dt>
                        <dd className="text-[var(--text)]">{detail.data.family ?? "Not stored"}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      Licensed control text is not included
                      {detail.data.licensed_text_included
                        ? " (API unexpectedly marked licensed text present)."
                        : "."}
                    </p>
                  </Panel>

                  <Panel
                    title="Mapped policies"
                    description="Policies linked to this control. Relationship-only; no nested version bodies."
                  >
                    <div data-testid="control-mapped-policies">
                      {(detail.data.policies ?? []).length === 0 ? (
                        <p
                          className="text-sm text-[var(--muted)]"
                          data-testid="control-mapped-policies-empty"
                        >
                          No policies are mapped to this control.
                        </p>
                      ) : (
                        <ul className="space-y-2" data-testid="control-mapped-policies-list">
                          {detail.data.policies.map((policy) => (
                            <li
                              key={policy.id}
                              className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-2"
                              data-testid={`control-mapped-policy-${policy.id}`}
                            >
                              <p className="text-sm font-medium text-[var(--text)]">
                                {policy.id} · {policy.title}
                              </p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {policy.status.replaceAll("_", " ")}
                                {policy.current_version
                                  ? ` · current ${policy.current_version}`
                                  : ""}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Panel>

                  <Panel
                    title="Implementation"
                    description="Update stored implementation status and notes."
                  >
                    <ControlImplementationEditor
                      controlId={detail.data.id}
                      implementation={detail.data.implementation}
                      canManage={canManageControls}
                    />
                  </Panel>

                  <Panel title="Control tests" description="Manual development recordings only.">
                    <ControlTestPanel
                      controlId={detail.data.id}
                      tests={detail.data.tests}
                      canManage={canManageControls}
                    />
                  </Panel>

                  <Panel
                    title="Evidence"
                    description="Metadata, private file upload through the API, and control associations."
                  >
                    <ControlEvidencePanel
                      controlId={detail.data.id}
                      evidence={detail.data.evidence}
                      canReadEvidence={canReadEvidence}
                      canManageEvidence={canManageEvidence}
                      canLink={canLinkEvidence}
                    />
                  </Panel>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
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
