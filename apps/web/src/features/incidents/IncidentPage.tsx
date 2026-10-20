import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { SummaryMetric } from "@/components/cards/SummaryMetric";
import { SimulatedDataBanner } from "@/components/feedback/SimulatedDataBanner";
import { AppShell } from "@/components/navigation/AppShell";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StatusBadge } from "@/components/status/StatusBadge";
import { IncidentTable } from "@/features/incidents/IncidentTable";
import { useIncidentData } from "@/features/incidents/useIncidentData";
import { cn } from "@/lib/cn";
import type { IncidentRecord, IncidentSectionId, TimelineEvent } from "@/types/incident";

const sections: { id: IncidentSectionId; label: string }[] = [
  { id: "incidents", label: "Incidents" },
  { id: "timeline", label: "Timeline" },
  { id: "tasks", label: "Tasks" },
  { id: "indicators", label: "Indicators" },
  { id: "evidence", label: "Evidence" },
];

export function IncidentPage() {
  const queue = useIncidentData();
  const [section, setSection] = useState<IncidentSectionId>("incidents");
  const [selectedId, setSelectedId] = useState("inc-002");
  const selected =
    queue.data.incidents.find((item) => item.id === selectedId) ?? queue.data.incidents[0];
  const timeline = queue.data.timeline.filter((item) => item.incidentId === selected?.incidentId);
  const tasks = queue.data.tasks.filter((item) => item.incidentId === selected?.incidentId);
  const evidence = queue.data.evidence.filter((item) => item.incidentId === selected?.incidentId);

  return (
    <AppShell environmentLabel={queue.data.environmentLabel}>
      <PageContainer data-testid="incidents-page">
        <PageHeader
          title="Incident response"
          description="Coordinate decisions, containment, recovery, and follow-up."
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <Button
                type="button"
                disabled
                title="Incident creation is not connected in this phase"
                aria-label="Create incident (not connected in this phase)"
              >
                Create incident
              </Button>
              <SimulatedDataBanner message={queue.data.snapshotLabel} />
            </div>
          }
        />

        <div
          role="tablist"
          aria-label="Incident sections"
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
          {section === "incidents" && selected ? (
            <>
              <section aria-labelledby="incident-summary-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2
                    id="incident-summary-heading"
                    className="font-heading text-xl font-bold text-[var(--text)]"
                  >
                    Response snapshot
                  </h2>
                  <StatusBadge label="SIMULATED" tone="warning" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {queue.data.metrics.map((metric) => (
                    <SummaryMetric key={metric.id} metric={metric} />
                  ))}
                </div>
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Severity and lifecycle status stay separate. There is no aggregate security score.
                </p>
              </section>

              <Panel
                title="Incident queue"
                description="Sample incidents from the simulated AegisBridge Technologies lab. Not every alert is an incident."
              >
                <IncidentTable
                  incidents={queue.data.incidents}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </Panel>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
                <Panel title={`${selected.incidentId} · Response timeline`} className="h-full">
                  <IncidentContext
                    incident={selected}
                    timeline={timeline}
                    openTasks={tasks.filter((item) => item.status !== "Done")}
                    evidenceIds={evidence.map((item) => item.evidenceId)}
                  />
                </Panel>
                <Panel title="Workflow & interpretation" className="h-full">
                  <ul className="space-y-3">
                    {queue.data.workflowNotes.map((note) => (
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

          {section === "timeline" && selected ? (
            <Panel
              title={`${selected.incidentId} · Timeline`}
              description="Ordered events for the selected incident."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <TimelineList events={timeline} />
            </Panel>
          ) : null}

          {section === "tasks" ? (
            <Panel
              title="Tasks"
              description="Owners, due dates, priority, and overdue state. Overdue is not a severity."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <div className="hidden overflow-x-auto md:block" data-testid="incident-tasks">
                <table className="min-w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Incident tasks with owner, due date, status, priority, and overdue state
                  </caption>
                  <thead className="text-[var(--muted)]">
                    <tr>
                      {["Task", "Incident", "Owner", "Due", "Status", "Priority", "Schedule"].map(
                        (heading) => (
                          <th key={heading} scope="col" className="px-3 py-3 font-medium">
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.data.tasks.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--border)]">
                        <td className="px-3 py-3 text-[var(--text)]">
                          {item.taskId}
                          <span className="mt-1 block text-xs text-[var(--muted)]">
                            {item.title}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.incidentId}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.owner}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.dueLabel}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{item.status}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{item.priority}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">
                          {item.overdue ? "Overdue" : "On schedule"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 md:hidden">
                {queue.data.tasks.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {item.taskId} · {item.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.owner} · Due {item.dueLabel} · {item.status} · {item.priority} ·{" "}
                      {item.overdue ? "Overdue" : "On schedule"}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {section === "indicators" ? (
            <Panel
              title="Indicators"
              description="Simulated context only. These values are not real malicious indicators."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <ul className="space-y-3" data-testid="incident-indicators">
                {queue.data.indicators.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {item.indicatorId} · {item.kind}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text)]">{item.value}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.incidentId} · {item.context}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {section === "evidence" ? (
            <Panel
              title="Evidence"
              description="References only. Object storage is not connected."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <div className="hidden overflow-x-auto md:block" data-testid="incident-evidence">
                <table className="min-w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Evidence references with type, capture time, integrity status, and linked
                    records
                  </caption>
                  <thead className="text-[var(--muted)]">
                    <tr>
                      {["Evidence", "Type", "Captured", "Integrity", "Linked records"].map(
                        (heading) => (
                          <th key={heading} scope="col" className="px-3 py-3 font-medium">
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.data.evidence.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--border)]">
                        <td className="px-3 py-3 text-[var(--text)]">{item.evidenceId}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.type}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">{item.capturedLabel}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{item.integrityStatus}</td>
                        <td className="px-3 py-3 text-[var(--muted)]">
                          {item.linkedControls} · {item.incidentId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 md:hidden">
                {queue.data.evidence.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {item.evidenceId} · {item.type}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.capturedLabel} · {item.integrityStatus}
                    </p>
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

function IncidentContext({
  incident,
  timeline,
  openTasks,
  evidenceIds,
}: {
  incident: IncidentRecord;
  timeline: TimelineEvent[];
  openTasks: { taskId: string; title: string }[];
  evidenceIds: string[];
}) {
  const latest = timeline[timeline.length - 1];
  return (
    <div className="space-y-4 text-sm" data-testid="incident-context">
      <div>
        <p className="text-[var(--muted)]">Title</p>
        <p className="mt-1 text-[var(--text)]">{incident.title}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Severity and status</p>
        <p className="mt-1 text-[var(--text)]">
          {incident.severity} severity · {incident.status} status
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Owner</p>
        <p className="mt-1 text-[var(--text)]">{incident.owner}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Affected assets</p>
        <p className="mt-1 text-[var(--text)]">
          {incident.affectedService}
          {incident.assets.length > 0
            ? ` · ${incident.assets.map((asset) => asset.hostname).join(", ")}`
            : ""}
          {incident.assets.some((asset) => asset.slug) ? (
            <>
              {" "}
              ·{" "}
              {incident.assets
                .filter((asset) => asset.slug)
                .map((asset) => (
                  <Link
                    key={asset.hostname}
                    to={`/assets/${asset.slug}`}
                    className="inline-flex min-h-11 items-center font-semibold text-[var(--accent)]"
                  >
                    Open {asset.hostname}
                  </Link>
                ))}
            </>
          ) : null}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Linked alerts</p>
        <p className="mt-1 text-[var(--text)]">
          {incident.relatedAlerts.length > 0
            ? incident.relatedAlerts.join(", ")
            : "No source alert."}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Summary</p>
        <p className="mt-1 text-[var(--text)]">{incident.summary}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Latest timeline event</p>
        <p className="mt-1 text-[var(--text)]">
          {latest
            ? `${latest.whenLabel} · ${latest.title}. ${latest.detail}`
            : "No events recorded."}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Containment</p>
        <p className="mt-1 text-[var(--text)]">{incident.containment}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Open tasks</p>
        <p className="mt-1 text-[var(--text)]">
          {openTasks.length > 0
            ? openTasks.map((task) => `${task.taskId} ${task.title}`).join(" · ")
            : "No open tasks."}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Evidence</p>
        <p className="mt-1 text-[var(--text)]">
          {evidenceIds.length > 0 ? evidenceIds.join(", ") : "No evidence reference yet."}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Next action</p>
        <p className="mt-1 text-[var(--text)]">{incident.nextAction}</p>
      </div>
      <TimelineList events={timeline} />
    </div>
  );
}

function TimelineList({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="space-y-3" aria-label="Response timeline" data-testid="incident-timeline">
      {events.map((event) => (
        <li
          key={event.id}
          className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 py-3"
        >
          <p className="font-medium text-[var(--text)]">
            {event.whenLabel} · {event.title}
          </p>
          <p className="mt-1 text-[var(--muted)]">{event.detail}</p>
        </li>
      ))}
    </ol>
  );
}
