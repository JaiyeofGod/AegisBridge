import { useDeferredValue, useEffect, useMemo, useState } from "react";

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
import {
  DatasetRegistryTable,
  type DatasetTableFilters,
} from "@/features/reports/DatasetRegistryTable";
import {
  mapDataset,
  mapDatasetDetail,
  mapExperiment,
  mapReportDefinition,
  mapReportsSummary,
  type DatasetDetailView,
  type DatasetView,
  type ExperimentView,
  type ReportDefinitionView,
} from "@/features/reports/mapReports";
import { ReportLibraryTable, type ReportTableFilters } from "@/features/reports/ReportLibraryTable";
import {
  useDatasetCatalog,
  useDatasetDetail,
  useDatasetList,
  useExperimentCatalog,
  useExperimentDetail,
  useExperimentList,
  useReportDefinitionCatalog,
  useReportDefinitionDetail,
  useReportDefinitionList,
  useReportsSummary,
} from "@/features/reports/useReportData";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { DatasetQuery, ExperimentQuery, ReportDefinitionQuery } from "@/services/api-types";
import type { ReportSectionId } from "@/types/reports";

const sections: { id: ReportSectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "reports", label: "Reports" },
  { id: "exports", label: "Exports" },
  { id: "datasets", label: "Datasets" },
  { id: "research", label: "Research" },
];

const emptyReportFilters: ReportTableFilters = {
  search: "",
  status: "all",
  reportType: "all",
};

const emptyDatasetFilters: DatasetTableFilters = {
  search: "",
  status: "all",
  domain: "all",
  verificationStatus: "all",
  publicationYear: "all",
};

const emptyExperimentFilters = {
  search: "",
  status: "all",
  datasetId: "all",
  experimentType: "all",
};

export function ReportsPage() {
  const summary = useReportsSummary();
  const reportCatalog = useReportDefinitionCatalog();
  const datasetCatalog = useDatasetCatalog();
  const experimentCatalog = useExperimentCatalog();

  const [section, setSection] = useState<ReportSectionId>("overview");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedExperimentId, setSelectedExperimentId] = useState("");
  const [reportFilters, setReportFilters] = useState(emptyReportFilters);
  const [datasetFilters, setDatasetFilters] = useState(emptyDatasetFilters);
  const [experimentFilters, setExperimentFilters] = useState(emptyExperimentFilters);

  const deferredReportSearch = useDeferredValue(reportFilters.search.trim());
  const deferredDatasetSearch = useDeferredValue(datasetFilters.search.trim());
  const deferredExperimentSearch = useDeferredValue(experimentFilters.search.trim());

  const reportQuery = buildReportQuery({
    ...reportFilters,
    search: deferredReportSearch,
  });
  const datasetQuery = buildDatasetQuery({
    ...datasetFilters,
    search: deferredDatasetSearch,
  });
  const experimentQuery = buildExperimentQuery({
    ...experimentFilters,
    search: deferredExperimentSearch,
  });

  const hasReportFilters = Object.keys(reportQuery).length > 0;
  const hasDatasetFilters = Object.keys(datasetQuery).length > 0;
  const hasExperimentFilters = Object.keys(experimentQuery).length > 0;

  const filteredReports = useReportDefinitionList(reportQuery, hasReportFilters);
  const filteredDatasets = useDatasetList(datasetQuery, hasDatasetFilters);
  const filteredExperiments = useExperimentList(experimentQuery, hasExperimentFilters);

  const reportItems = (
    hasReportFilters ? (filteredReports.data?.items ?? []) : (reportCatalog.data?.items ?? [])
  ).map(mapReportDefinition);
  const datasetItems = (
    hasDatasetFilters ? (filteredDatasets.data?.items ?? []) : (datasetCatalog.data?.items ?? [])
  ).map(mapDataset);
  const experimentItems = (
    hasExperimentFilters
      ? (filteredExperiments.data?.items ?? [])
      : (experimentCatalog.data?.items ?? [])
  ).map(mapExperiment);

  useEffect(() => {
    if (!selectedReportId && reportItems[0]) setSelectedReportId(reportItems[0].id);
  }, [reportItems, selectedReportId]);

  useEffect(() => {
    if (!selectedDatasetId && datasetItems[0]) setSelectedDatasetId(datasetItems[0].id);
  }, [datasetItems, selectedDatasetId]);

  useEffect(() => {
    if (!selectedExperimentId && experimentItems[0]) {
      setSelectedExperimentId(experimentItems[0].id);
    }
  }, [experimentItems, selectedExperimentId]);

  const reportDetail = useReportDefinitionDetail(selectedReportId);
  const datasetDetail = useDatasetDetail(selectedDatasetId);
  const experimentDetail = useExperimentDetail(selectedExperimentId);

  const selectedReport =
    (reportDetail.data ? mapReportDefinition(reportDetail.data) : null) ??
    reportItems.find((item) => item.id === selectedReportId) ??
    null;
  const selectedDataset =
    (datasetDetail.data ? mapDatasetDetail(datasetDetail.data) : null) ??
    datasetItems.find((item) => item.id === selectedDatasetId) ??
    null;
  const selectedExperiment =
    (experimentDetail.data ? mapExperiment(experimentDetail.data) : null) ??
    experimentItems.find((item) => item.id === selectedExperimentId) ??
    null;

  const mapped = summary.data ? mapReportsSummary(summary.data) : null;
  const generatedAt = summary.dataUpdatedAt
    ? new Date(summary.dataUpdatedAt).toISOString()
    : new Date().toISOString();

  const reportTypeOptions = useMemo(() => {
    const items = reportCatalog.data?.items ?? [];
    return Array.from(new Set(items.map((item) => item.report_type)))
      .sort()
      .map((value) => {
        const match = items.find((item) => item.report_type === value);
        return {
          value,
          label: match ? mapReportDefinition(match).reportTypeLabel : value,
        };
      });
  }, [reportCatalog.data?.items]);

  const domainOptions = useMemo(() => {
    const values = (datasetCatalog.data?.items ?? [])
      .map((item) => item.domain)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(values))
      .sort()
      .map((value) => ({ value, label: value }));
  }, [datasetCatalog.data?.items]);

  const yearOptions = useMemo(() => {
    const values = (datasetCatalog.data?.items ?? [])
      .map((item) => item.publication_year)
      .filter((value): value is number => value != null);
    return Array.from(new Set(values))
      .sort((a, b) => b - a)
      .map((value) => ({ value: String(value), label: String(value) }));
  }, [datasetCatalog.data?.items]);

  const datasetIdOptions = useMemo(() => {
    return (datasetCatalog.data?.items ?? []).map((item) => ({
      value: item.id,
      label: `${item.id} · ${item.name}`,
    }));
  }, [datasetCatalog.data?.items]);

  const experimentTypeOptions = useMemo(() => {
    const values = (experimentCatalog.data?.items ?? [])
      .map((item) => item.experiment_type)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(values))
      .sort()
      .map((value) => ({ value, label: value }));
  }, [experimentCatalog.data?.items]);

  const refreshing =
    summary.isFetching ||
    reportCatalog.isFetching ||
    filteredReports.isFetching ||
    reportDetail.isFetching ||
    datasetCatalog.isFetching ||
    filteredDatasets.isFetching ||
    datasetDetail.isFetching ||
    experimentCatalog.isFetching ||
    filteredExperiments.isFetching ||
    experimentDetail.isFetching;

  const featured = reportItems.slice(0, Math.min(3, reportItems.length));

  return (
    <AppShell environmentLabel="Development · Seeded">
      <PageContainer data-testid="reports-page">
        <PageHeader
          title="Reports & analytics"
          description="Create traceable reports and evaluate research results."
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <Button
                type="button"
                disabled
                title="Report generation is not connected in this phase"
                aria-label="Create report (not connected in this phase)"
              >
                Create report
              </Button>
              <SimulatedDataBanner message={SEEDED_DATA_NOTE} />
              {summary.dataUpdatedAt ? (
                <p className="text-xs text-[var(--muted)]" data-testid="last-successful-fetch">
                  Last successful update: {formatTimestamp(generatedAt)}
                </p>
              ) : null}
            </div>
          }
        />

        <div
          role="tablist"
          aria-label="Report sections"
          className="mb-8 flex flex-wrap gap-2 border-b border-[var(--border)] pb-3"
        >
          {sections.map((item) => {
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                  active
                    ? "bg-[var(--raised)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]",
                )}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {summary.isPending ? <LoadingState label="Updating" rows={4} /> : null}
        {summary.isError ? (
          <ErrorState
            title="Reports data unavailable"
            description="The development reports API did not respond. Retry to load the seeded summary. Fixture rows are not substituted."
            lastSuccessfulAt={summary.dataUpdatedAt ? generatedAt : undefined}
            onRetry={() => void summary.refetch()}
          />
        ) : null}
        {summary.isSuccess && refreshing ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development report and dataset records"
              lastSuccessfulAt={generatedAt}
            />
          </div>
        ) : null}

        {summary.isSuccess && mapped ? (
          <div className="space-y-8">
            {section === "overview" ? (
              <>
                <section aria-labelledby="report-summary-heading">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2
                      id="report-summary-heading"
                      className="font-heading text-xl font-bold text-[var(--text)]"
                    >
                      Reporting snapshot
                    </h2>
                    <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {mapped.metrics.map((metric) => (
                      <SummaryMetric key={metric.id} metric={metric} />
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-[var(--muted)]">
                    Completed executions: {summary.data.completed_report_count}. Failed:{" "}
                    {summary.data.failed_report_count}. Recent executions:{" "}
                    {summary.data.recent_execution_count}. There is no aggregate security score and
                    no maturity score.
                  </p>
                </section>

                <Panel
                  title="Report library"
                  description="Stored definitions from the development registry. No PDF or CSV is generated here."
                >
                  {reportCatalog.isPending ? <LoadingState label="Updating" rows={2} /> : null}
                  {reportCatalog.isError ? (
                    <ErrorState
                      title="Report definitions unavailable"
                      description="The definitions request failed. Fixture reports are not substituted."
                      onRetry={() => void reportCatalog.refetch()}
                    />
                  ) : null}
                  {reportCatalog.isSuccess && featured.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No report definitions are stored.</p>
                  ) : null}
                  {reportCatalog.isSuccess && featured.length > 0 ? (
                    <ReportLibraryTable
                      reports={featured}
                      total={reportCatalog.data.total}
                      selectedId={selectedReport?.id ?? ""}
                      onSelect={setSelectedReportId}
                      filters={emptyReportFilters}
                      onFiltersChange={() => undefined}
                      reportTypeOptions={reportTypeOptions}
                      emptyLabel="No report definitions are stored."
                      showFilters={false}
                    />
                  ) : null}
                </Panel>

                <Panel
                  title="Operational counts"
                  description="Counts from stored development metadata. Not a forecast and not a score."
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <caption className="sr-only">
                        Operational counts with the reporting window. These counts are not a score.
                      </caption>
                      <thead className="text-[var(--muted)]">
                        <tr>
                          {["Measure", "Value", "Window"].map((heading) => (
                            <th key={heading} scope="col" className="px-3 py-3 font-medium">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mapped.counts.map((row) => (
                          <tr key={row.id} className="border-t border-[var(--border)]">
                            <td className="px-3 py-3 text-[var(--text)]">{row.measure}</td>
                            <td className="px-3 py-3 text-[var(--text)]">{row.value}</td>
                            <td className="px-3 py-3 text-[var(--muted)]">{row.window}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
                  <Panel title="Report integrity" className="h-full">
                    {selectedReport ? (
                      <ReportIntegrity
                        report={selectedReport}
                        detailPending={reportDetail.isPending}
                      />
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No report definition is selected.
                      </p>
                    )}
                  </Panel>
                  <Panel title="Workflow & interpretation" className="h-full">
                    <ul className="space-y-3">
                      {mapped.notes.map((note) => (
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
            ) : null}

            {section === "reports" ? (
              <Panel
                title="Reports"
                description="Stored definitions only. Files are not produced here and no scheduler is running."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                {reportCatalog.isPending && !hasReportFilters ? (
                  <LoadingState label="Updating" rows={2} />
                ) : null}
                {reportCatalog.isError && !hasReportFilters ? (
                  <ErrorState
                    title="Report definitions unavailable"
                    description="The definitions request failed. Fixture reports are not substituted."
                    onRetry={() => void reportCatalog.refetch()}
                  />
                ) : null}
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
                  <ReportLibraryTable
                    reports={reportItems}
                    total={
                      hasReportFilters
                        ? (filteredReports.data?.total ?? reportItems.length)
                        : (reportCatalog.data?.total ?? reportItems.length)
                    }
                    selectedId={selectedReport?.id ?? ""}
                    onSelect={setSelectedReportId}
                    filters={reportFilters}
                    onFiltersChange={setReportFilters}
                    reportTypeOptions={reportTypeOptions}
                    emptyLabel={
                      hasReportFilters && filteredReports.isPending
                        ? "Updating report filters."
                        : hasReportFilters
                          ? "No report definitions match the current filters."
                          : "No report definitions are stored."
                    }
                  />
                  <Panel title="Definition detail" className="h-full">
                    {selectedReport ? (
                      <ReportIntegrity
                        report={selectedReport}
                        detailPending={reportDetail.isPending}
                      />
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No report definition is selected.
                      </p>
                    )}
                  </Panel>
                </div>
              </Panel>
            ) : null}

            {section === "exports" ? (
              <Panel
                title="Exports"
                description="No report execution or export rows are stored in this phase."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                <div className="space-y-3 text-sm text-[var(--muted)]" data-testid="report-exports">
                  <p>No generated report files are stored.</p>
                  <p>
                    Completed executions: {summary.data.completed_report_count}. Failed:{" "}
                    {summary.data.failed_report_count}. Recent executions:{" "}
                    {summary.data.recent_execution_count}.
                  </p>
                  <p>
                    A schedule cadence on a definition does not mean a background export worker is
                    running.
                  </p>
                </div>
              </Panel>
            ) : null}

            {section === "datasets" ? (
              <>
                <Panel
                  title="Datasets"
                  description="Registry metadata only unless files are stored. No download pipeline is connected."
                  action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
                >
                  {datasetCatalog.isPending && !hasDatasetFilters ? (
                    <LoadingState label="Updating" rows={2} />
                  ) : null}
                  {datasetCatalog.isError && !hasDatasetFilters ? (
                    <ErrorState
                      title="Dataset registry unavailable"
                      description="The dataset request failed. Fixture datasets are not substituted."
                      onRetry={() => void datasetCatalog.refetch()}
                    />
                  ) : null}
                  <DatasetRegistryTable
                    datasets={datasetItems}
                    total={
                      hasDatasetFilters
                        ? (filteredDatasets.data?.total ?? datasetItems.length)
                        : (datasetCatalog.data?.total ?? datasetItems.length)
                    }
                    selectedId={selectedDataset?.id ?? ""}
                    onSelect={setSelectedDatasetId}
                    filters={datasetFilters}
                    onFiltersChange={setDatasetFilters}
                    domainOptions={domainOptions}
                    yearOptions={yearOptions}
                    emptyLabel={
                      hasDatasetFilters && filteredDatasets.isPending
                        ? "Updating dataset filters."
                        : hasDatasetFilters
                          ? "No datasets match the current filters."
                          : "No datasets are stored."
                    }
                  />
                </Panel>
                <Panel title="Dataset detail">
                  {selectedDataset ? (
                    <DatasetDetailPanel
                      dataset={selectedDataset}
                      detailPending={datasetDetail.isPending}
                    />
                  ) : (
                    <p className="text-sm text-[var(--muted)]">No dataset is selected.</p>
                  )}
                </Panel>
              </>
            ) : null}

            {section === "research" ? (
              <>
                <Panel
                  title="Research"
                  description="Experiment metadata tied to registry entries. No research runtime is installed."
                  action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
                >
                  {experimentCatalog.isPending && !hasExperimentFilters ? (
                    <LoadingState label="Updating" rows={2} />
                  ) : null}
                  {experimentCatalog.isError && !hasExperimentFilters ? (
                    <ErrorState
                      title="Experiments unavailable"
                      description="The experiment request failed. Fixture experiments are not substituted."
                      onRetry={() => void experimentCatalog.refetch()}
                    />
                  ) : null}
                  <ExperimentList
                    experiments={experimentItems}
                    total={
                      hasExperimentFilters
                        ? (filteredExperiments.data?.total ?? experimentItems.length)
                        : (experimentCatalog.data?.total ?? experimentItems.length)
                    }
                    selectedId={selectedExperiment?.id ?? ""}
                    onSelect={setSelectedExperimentId}
                    filters={experimentFilters}
                    onFiltersChange={setExperimentFilters}
                    datasetOptions={datasetIdOptions}
                    experimentTypeOptions={experimentTypeOptions}
                    emptyLabel={
                      hasExperimentFilters && filteredExperiments.isPending
                        ? "Updating experiment filters."
                        : hasExperimentFilters
                          ? "No experiments match the current filters."
                          : "No experiments are stored."
                    }
                  />
                </Panel>
                <Panel title="Experiment detail">
                  {selectedExperiment ? (
                    <ExperimentDetailPanel
                      experiment={selectedExperiment}
                      detailPending={experimentDetail.isPending}
                    />
                  ) : (
                    <p className="text-sm text-[var(--muted)]">No experiment is selected.</p>
                  )}
                </Panel>
              </>
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function ReportIntegrity({
  report,
  detailPending,
}: {
  report: ReportDefinitionView;
  detailPending: boolean;
}) {
  return (
    <div className="space-y-4 text-sm" data-testid="report-integrity">
      {detailPending ? <p className="text-[var(--muted)]">Updating definition detail…</p> : null}
      <div>
        <p className="text-[var(--muted)]">Report</p>
        <p className="mt-1 text-[var(--text)]">
          {report.id} · {report.name}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Description</p>
        <p className="mt-1 text-[var(--text)]">{report.description}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Type and status</p>
        <p className="mt-1 text-[var(--text)]">
          {report.reportTypeLabel} ({report.reportType}). Status {report.statusLabel} (
          {report.status}). Format {report.formatLabel}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Schedule</p>
        <p className="mt-1 text-[var(--text)]">
          {report.scheduleStateLabel} ({report.scheduleState}). Cadence {report.scheduleLabel}. A
          stored cadence is not a running scheduler or worker.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Provenance</p>
        <p className="mt-1 text-[var(--text)]">
          Owner {report.owner}. Created {report.createdAt}. Updated {report.updatedAt}. Last run{" "}
          {report.lastRunAt}. Next run {report.nextRunAt}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Generated files</p>
        <p className="mt-1 text-[var(--text)]">
          {report.hasGeneratedFiles
            ? report.generatedFiles.join(", ")
            : "No generated files are stored for this definition."}
        </p>
      </div>
    </div>
  );
}

function DatasetDetailPanel({
  dataset,
  detailPending,
}: {
  dataset: DatasetView | DatasetDetailView;
  detailPending: boolean;
}) {
  const detail = "versions" in dataset ? dataset : null;
  return (
    <div className="space-y-4 text-sm" data-testid="dataset-detail">
      {detailPending ? <p className="text-[var(--muted)]">Updating dataset detail…</p> : null}
      <div>
        <p className="text-[var(--muted)]">Dataset</p>
        <p className="mt-1 text-[var(--text)]">
          {dataset.id} · {dataset.name}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Source</p>
        <p className="mt-1 text-[var(--text)]">
          Publisher {dataset.publisher}. Source {dataset.sourceLabel}. URL {dataset.sourceUrl}. Year{" "}
          {dataset.publicationYear}. Domain {dataset.domain}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Lifecycle and verification</p>
        <p className="mt-1 text-[var(--text)]">
          Lifecycle {dataset.statusLabel} ({dataset.status}). Verification{" "}
          {dataset.verificationLabel} ({dataset.verificationStatus}). These states stay separate.
          {dataset.status === "not_downloaded"
            ? " not_downloaded means the registry entry is not locally available."
            : ""}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Stored counts</p>
        <p className="mt-1 text-[var(--text)]">
          License {dataset.licenseLabel}. Rows {dataset.rowCount}. Features {dataset.featureCount}.
          Files {dataset.fileCount}. Versions {dataset.versionCount}. Experiments{" "}
          {dataset.experimentCount}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Notes</p>
        <p className="mt-1 text-[var(--text)]">{dataset.notes}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Files</p>
        {dataset.registryOnly || (detail && detail.files.length === 0) ? (
          <p className="mt-1 text-[var(--text)]">
            Registry metadata only. No dataset files are stored.
          </p>
        ) : detail ? (
          <ul className="mt-1 space-y-1 text-[var(--text)]">
            {detail.files.map((file) => (
              <li key={file.filename}>
                {file.filename} · hash {file.sha256} · size {file.sizeBytes}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[var(--text)]">File metadata loads with the detail record.</p>
        )}
      </div>
      {detail ? (
        <div>
          <p className="text-[var(--muted)]">Versions</p>
          <ul className="mt-1 space-y-1 text-[var(--text)]">
            {detail.versions.map((version) => (
              <li key={version.versionLabel}>
                {version.versionLabel} · files {version.fileCount} · experiments{" "}
                {version.experimentCount} · {version.createdAt}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ExperimentList({
  experiments,
  total,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
  datasetOptions,
  experimentTypeOptions,
  emptyLabel,
}: {
  experiments: ExperimentView[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
  filters: typeof emptyExperimentFilters;
  onFiltersChange: (filters: typeof emptyExperimentFilters) => void;
  datasetOptions: Array<{ value: string; label: string }>;
  experimentTypeOptions: Array<{ value: string; label: string }>;
  emptyLabel: string;
}) {
  const selectClass =
    "min-h-11 min-w-[140px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

  return (
    <div className="space-y-4" data-testid="report-research">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
        <div className="min-w-[200px] flex-1">
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="experiment-search"
          >
            Search records
          </label>
          <input
            id="experiment-search"
            type="search"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search experiments…"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="experiment-status"
          >
            Status
          </label>
          <select
            id="experiment-status"
            className={selectClass}
            value={filters.status}
            onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="planned">Planned</option>
          </select>
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="experiment-dataset"
          >
            Dataset
          </label>
          <select
            id="experiment-dataset"
            className={selectClass}
            value={filters.datasetId}
            onChange={(event) => onFiltersChange({ ...filters, datasetId: event.target.value })}
          >
            <option value="all">All</option>
            {datasetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-[var(--text)]"
            htmlFor="experiment-type"
          >
            Experiment type
          </label>
          <select
            id="experiment-type"
            className={selectClass}
            value={filters.experimentType}
            onChange={(event) =>
              onFiltersChange({ ...filters, experimentType: event.target.value })
            }
          >
            <option value="all">All</option>
            {experimentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {experiments.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {experiments.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={selectedId === item.id}
                onClick={() => onSelect(item.id)}
                className="w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <p className="font-medium text-[var(--text)]">
                  {item.id} · {item.name}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {item.datasetId} · {item.statusLabel} · {item.experimentType} · {item.completedAt}
                </p>
                <p className="mt-1 text-sm text-[var(--text)]">{item.approach}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.metricsSummary}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--muted)]">
        Showing {experiments.length} of {total} stored experiments · Metrics are shown exactly as
        stored
      </p>
    </div>
  );
}

function ExperimentDetailPanel({
  experiment,
  detailPending,
}: {
  experiment: ExperimentView;
  detailPending: boolean;
}) {
  return (
    <div className="space-y-4 text-sm" data-testid="experiment-detail">
      {detailPending ? <p className="text-[var(--muted)]">Updating experiment detail…</p> : null}
      <div>
        <p className="text-[var(--muted)]">Experiment</p>
        <p className="mt-1 text-[var(--text)]">
          {experiment.id} · {experiment.name}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Dataset reference</p>
        <p className="mt-1 text-[var(--text)]">
          {experiment.datasetId} · {experiment.datasetTitle}. Version{" "}
          {experiment.datasetVersionLabel}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Type and approach</p>
        <p className="mt-1 text-[var(--text)]">
          Status {experiment.statusLabel} ({experiment.status}). Type {experiment.experimentType}.
          Approach {experiment.approach}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Metrics</p>
        <p className="mt-1 text-[var(--text)]">
          {experiment.hasMetrics ? experiment.metricsSummary : "No metrics or results are stored."}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Stored metric text is not a stronger model-performance claim.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Timestamps</p>
        <p className="mt-1 text-[var(--text)]">
          Started {experiment.startedAt}. Completed {experiment.completedAt}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Notes</p>
        <p className="mt-1 text-[var(--text)]">{experiment.notes}</p>
      </div>
    </div>
  );
}

function buildReportQuery(filters: ReportTableFilters): ReportDefinitionQuery {
  const query: ReportDefinitionQuery = {};
  if (filters.search) query.search = filters.search;
  if (filters.status !== "all") query.status = filters.status;
  if (filters.reportType !== "all") query.reportType = filters.reportType;
  return query;
}

function buildDatasetQuery(filters: DatasetTableFilters & { search: string }): DatasetQuery {
  const query: DatasetQuery = {};
  if (filters.search) query.search = filters.search;
  if (filters.status !== "all") query.status = filters.status;
  if (filters.domain !== "all") query.domain = filters.domain;
  if (filters.verificationStatus !== "all") {
    query.verificationStatus = filters.verificationStatus;
  }
  if (filters.publicationYear !== "all") {
    query.publicationYear = Number(filters.publicationYear);
  }
  return query;
}

function buildExperimentQuery(
  filters: typeof emptyExperimentFilters & { search: string },
): ExperimentQuery {
  const query: ExperimentQuery = {};
  if (filters.search) query.search = filters.search;
  if (filters.status !== "all") query.status = filters.status;
  if (filters.datasetId !== "all") query.datasetId = filters.datasetId;
  if (filters.experimentType !== "all") query.experimentType = filters.experimentType;
  return query;
}
