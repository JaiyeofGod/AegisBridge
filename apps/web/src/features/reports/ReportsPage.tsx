import { useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { SummaryMetric } from "@/components/cards/SummaryMetric";
import { SimulatedDataBanner } from "@/components/feedback/SimulatedDataBanner";
import { AppShell } from "@/components/navigation/AppShell";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StatusBadge } from "@/components/status/StatusBadge";
import { ReportLibraryTable } from "@/features/reports/ReportLibraryTable";
import { useReportData } from "@/features/reports/useReportData";
import { cn } from "@/lib/cn";
import type { ReportRecord, ReportSectionId } from "@/types/reports";

const sections: { id: ReportSectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "reports", label: "Reports" },
  { id: "exports", label: "Exports" },
  { id: "datasets", label: "Datasets" },
  { id: "research", label: "Research" },
];

export function ReportsPage() {
  const catalog = useReportData();
  const [section, setSection] = useState<ReportSectionId>("overview");
  const [selectedId, setSelectedId] = useState("rpt-001");
  const selected =
    catalog.data.reports.find((item) => item.id === selectedId) ?? catalog.data.reports[0];
  const featured = catalog.data.reports.filter((item) => item.featured);

  return (
    <AppShell environmentLabel={catalog.data.environmentLabel}>
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
              <SimulatedDataBanner message={catalog.data.snapshotLabel} />
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

        <div className="space-y-8">
          {section === "overview" && selected ? (
            <>
              <section aria-labelledby="report-summary-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2
                    id="report-summary-heading"
                    className="font-heading text-xl font-bold text-[var(--text)]"
                  >
                    Reporting snapshot
                  </h2>
                  <StatusBadge label="SIMULATED" tone="warning" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {catalog.data.metrics.map((metric) => (
                    <SummaryMetric key={metric.id} metric={metric} />
                  ))}
                </div>
                <p className="mt-4 text-xs text-[var(--muted)]">
                  There is no aggregate security score and no maturity score.
                </p>
              </section>

              <Panel
                title="Report library"
                description="Featured definitions from the simulated catalog."
              >
                <ReportLibraryTable
                  reports={featured}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </Panel>

              <Panel
                title="Operational counts"
                description="Snapshot counts from other simulated modules. Not a forecast."
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
                      {catalog.data.counts.map((row) => (
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
                  <Integrity report={selected} />
                </Panel>
                <Panel title="Workflow & interpretation" className="h-full">
                  <ul className="space-y-3">
                    {catalog.data.workflowNotes.map((note) => (
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

          {section === "reports" && selected ? (
            <Panel
              title="Reports"
              description="Templates and recent simulated generations. Files are not produced here."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <ReportLibraryTable
                reports={catalog.data.reports}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </Panel>
          ) : null}

          {section === "exports" ? (
            <Panel
              title="Exports"
              description="2 completed and 1 pending. Prototype records only."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <ul className="space-y-3" data-testid="report-exports">
                {catalog.data.exports.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {item.exportId} · {item.format} · {item.reportId}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text)]">
                      {item.status} · {item.requestedLabel}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.note}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {section === "datasets" ? (
            <Panel
              title="Datasets"
              description="Registry only. No dataset is downloaded."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
              data-testid="report-datasets"
            >
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Dataset registry with year, domain, size class, license, download status,
                    purpose, and registry status
                  </caption>
                  <thead className="text-[var(--muted)]">
                    <tr>
                      {[
                        "Dataset",
                        "Year",
                        "Domain",
                        "Size",
                        "License",
                        "Download",
                        "Purpose",
                        "Registry",
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
                    {catalog.data.datasets.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--border)]">
                        <td className="px-3 py-3 text-[var(--text)]">
                          {item.datasetId}
                          <span className="mt-1 block text-xs text-[var(--muted)]">
                            {item.name}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.releaseYear}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.domain}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.sizeClass}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.license}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{item.downloadStatus}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.purpose}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{item.registryStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 md:hidden">
                {catalog.data.datasets.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {item.datasetId} · {item.name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.releaseYear} · {item.downloadStatus} · {item.registryStatus}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {section === "research" ? (
            <Panel
              title="Research"
              description="Experiment notes tied to registry entries. No research runtime is installed."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <ul className="space-y-3" data-testid="report-research">
                {catalog.data.experiments.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {item.experimentId} · {item.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.datasetId} · {item.status} · {item.lastRun} · Artifact {item.artifact}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text)]">{item.objective}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.resultSummary}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </PageContainer>
    </AppShell>
  );
}

function Integrity({ report }: { report: ReportRecord }) {
  return (
    <div className="space-y-4 text-sm" data-testid="report-integrity">
      <div>
        <p className="text-[var(--muted)]">Report</p>
        <p className="mt-1 text-[var(--text)]">
          {report.reportId} · {report.name}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Scope</p>
        <p className="mt-1 text-[var(--text)]">
          {report.scope}. Date window is the 19 Oct 2026 snapshot.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Provenance</p>
        <p className="mt-1 text-[var(--text)]">
          {report.freshness}. Owner {report.owner}. Format {report.format}. Status {report.status}.
          {report.schedule ? ` Schedule ${report.schedule}.` : ""}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Research</p>
        <p className="mt-1 text-[var(--text)]">
          Dataset version, license, and split strategy stay on the dataset registry.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Exports</p>
        <p className="mt-1 text-[var(--text)]">
          Simulated-data label and generated timestamp. No file is stored.
        </p>
      </div>
    </div>
  );
}
