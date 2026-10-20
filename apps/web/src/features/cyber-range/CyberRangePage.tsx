import { useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { SummaryMetric } from "@/components/cards/SummaryMetric";
import { SimulatedDataBanner } from "@/components/feedback/SimulatedDataBanner";
import { AppShell } from "@/components/navigation/AppShell";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StatusBadge } from "@/components/status/StatusBadge";
import { RangeTopology } from "@/features/cyber-range/RangeTopology";
import { useCyberRangeData } from "@/features/cyber-range/useCyberRangeData";
import { cn } from "@/lib/cn";
import type { LabSystem, RangeSectionId } from "@/types/cyber-range";

const sections: { id: RangeSectionId; label: string }[] = [
  { id: "topology", label: "Topology" },
  { id: "segments", label: "Segments" },
  { id: "scenarios", label: "Scenarios" },
  { id: "runs", label: "Runs" },
];

export function CyberRangePage() {
  const range = useCyberRangeData();
  const [section, setSection] = useState<RangeSectionId>("topology");
  const [selectedId, setSelectedId] = useState("linux-app-01");
  const selected =
    range.data.systems.find((system) => system.id === selectedId) ?? range.data.systems[0];

  return (
    <AppShell environmentLabel={range.data.environmentLabel}>
      <PageContainer data-testid="cyber-range-page">
        <PageHeader
          title="Cyber range"
          description="Inspect isolated segments and authorized scenario activity."
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <Button
                type="button"
                disabled
                title="Scenario execution is not connected in this phase"
                aria-label="View scenario (execution is not connected in this phase)"
              >
                View scenario
              </Button>
              <SimulatedDataBanner message={range.data.snapshotLabel} />
            </div>
          }
        />

        <div
          role="tablist"
          aria-label="Cyber range sections"
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
          {section === "topology" && selected ? (
            <>
              <section aria-labelledby="range-summary-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2
                    id="range-summary-heading"
                    className="font-heading text-xl font-bold text-[var(--text)]"
                  >
                    Range snapshot
                  </h2>
                  <StatusBadge label="SIMULATED" tone="warning" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {range.data.metrics.map((metric) => (
                    <SummaryMetric key={metric.id} metric={metric} />
                  ))}
                </div>
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Not connected to a live lab host. There is no aggregate security score.
                </p>
              </section>

              <Panel
                title="Segmented topology"
                description="2D plan of the five approved zones. Not live data and not a 3D view."
              >
                <RangeTopology
                  segments={range.data.segments}
                  systems={range.data.systems}
                  relationships={range.data.relationships}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </Panel>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
                <Panel title={`Selected · ${selected.hostname}`} className="h-full">
                  <SystemContext system={selected} />
                </Panel>
                <Panel title="Workflow & interpretation" className="h-full">
                  <ul className="space-y-3">
                    {range.data.workflowNotes.map((note) => (
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

          {section === "segments" ? (
            <Panel
              title="Segments"
              description="Approved lab networks. Isolation is policy, not an observed attack."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <ul className="space-y-3" data-testid="range-segments">
                {range.data.segments.map((segment) => (
                  <li
                    key={segment.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {segment.id} · {segment.cidr}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{segment.purpose}</p>
                    <p className="mt-1 text-sm text-[var(--text)]">Gateway {segment.gateway}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Systems: {segment.systems.length > 0 ? segment.systems.join(", ") : "None"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{segment.isolation}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {section === "scenarios" ? (
            <Panel
              title="Scenarios"
              description="Catalog only. Starting a run is not connected."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <div className="overflow-x-auto" data-testid="range-scenarios">
                <table className="min-w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Lab scenario catalog with targets, expected telemetry, detections, status, and
                    last validation result
                  </caption>
                  <thead className="text-[var(--muted)]">
                    <tr>
                      {[
                        "Scenario",
                        "Category",
                        "Targets",
                        "Expected telemetry",
                        "Detections",
                        "Status",
                        "Last run",
                        "Result",
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
                    {range.data.scenarios.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--border)]">
                        <td className="px-3 py-3 text-[var(--text)]">
                          {item.scenarioId}
                          <span className="mt-1 block text-xs text-[var(--muted)]">
                            {item.title}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.category}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.targets}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.expectedTelemetry}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.detections}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{item.status}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.lastRun}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{item.validationResult}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {section === "runs" ? (
            <Panel
              title="Runs"
              description="Recent simulated validation records. Not a live lab connection."
              action={<StatusBadge label="NOT CONNECTED" tone="warning" />}
            >
              <ul className="space-y-3" data-testid="range-runs">
                {range.data.runs.map((run) => (
                  <li
                    key={run.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {run.runId} · {run.scenarioId}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {run.started} · {run.duration} · {run.result}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text)]">
                      Detections {run.detections}. Sources {run.telemetrySources}.
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{run.notes}</p>
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

function SystemContext({ system }: { system: LabSystem }) {
  return (
    <div className="space-y-4 text-sm" data-testid="range-context">
      <div>
        <p className="text-[var(--muted)]">System</p>
        <p className="mt-1 text-[var(--text)]">
          {system.hostname} · {system.zone} · {system.address}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Role</p>
        <p className="mt-1 text-[var(--text)]">{system.role}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Connectivity</p>
        <p className="mt-1 text-[var(--text)]">
          Modeled routes, not attack proof. {system.summary}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Telemetry</p>
        <p className="mt-1 text-[var(--text)]">
          {system.telemetry}. {system.freshness}. {system.state}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Hypothetical versus observed</p>
        <p className="mt-1 text-[var(--text)]">
          Observed telemetry is limited to simulated agent or Suricata summaries. A hypothetical
          path is not observed telemetry.
        </p>
      </div>
    </div>
  );
}
