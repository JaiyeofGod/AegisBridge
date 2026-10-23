import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";

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
  IncidentTable,
  type IncidentFilterOption,
  type IncidentTableFilters,
} from "@/features/incidents/IncidentTable";
import { IncidentEditor } from "@/features/incidents/IncidentEditor";
import { IncidentTasksPanel } from "@/features/incidents/IncidentTasksPanel";
import {
  applyIncidentDetail,
  evidenceFrom,
  indicatorsFrom,
  mapIncidentInventory,
  timelineFrom,
} from "@/features/incidents/mapIncident";
import {
  useIncidentCatalog,
  useIncidentDetail,
  useIncidentList,
} from "@/features/incidents/useIncidentData";
import { useAuthStatus } from "@/features/auth/useAuthSession";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { IncidentDetailResponse, IncidentQuery } from "@/services/api-types";
import type { IncidentRecord, IncidentSectionId, TimelineEvent } from "@/types/incident";

const sections: { id: IncidentSectionId; label: string }[] = [
  { id: "incidents", label: "Incidents" },
  { id: "timeline", label: "Timeline" },
  { id: "tasks", label: "Tasks" },
  { id: "indicators", label: "Indicators" },
  { id: "evidence", label: "Evidence" },
];

const emptyFilters: IncidentTableFilters = {
  search: "",
  severity: "all",
  status: "all",
  owner: "all",
  containment: "all",
};

export function IncidentPage() {
  const catalog = useIncidentCatalog();
  const [section, setSection] = useState<IncidentSectionId>("incidents");
  const [selectedId, setSelectedId] = useState("");
  const [filters, setFilters] = useState<IncidentTableFilters>(emptyFilters);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const query = useMemo(
    () => toIncidentQuery({ ...filters, search: deferredSearch }),
    [filters, deferredSearch],
  );
  const hasServerFilters = Object.keys(query).length > 0;
  const filtered = useIncidentList(query, hasServerFilters);
  const generatedAt = catalog.dataUpdatedAt
    ? new Date(catalog.dataUpdatedAt).toISOString()
    : new Date().toISOString();
  const sourceItems = hasServerFilters ? (filtered.data?.items ?? []) : (catalog.data?.items ?? []);
  const snapshot = catalog.data ? mapIncidentInventory(catalog.data.items, generatedAt) : null;
  const listed = mapIncidentInventory(sourceItems, generatedAt).incidents;
  const selectedRow = listed.find((item) => item.id === selectedId) ?? listed[0];
  const detail = useIncidentDetail(selectedRow?.incidentId ?? "");
  const selected =
    detail.data && detail.data.id === selectedRow?.incidentId
      ? applyIncidentDetail(detail.data)
      : selectedRow;
  const visible = listed.map((item) => (item.id === selected?.id && selected ? selected : item));
  const timeline = detail.data ? timelineFrom(detail.data) : [];
  const indicators = detail.data ? indicatorsFrom(detail.data) : [];
  const evidence = detail.data ? evidenceFrom(detail.data) : [];
  const ownerOptions = uniqueOptions(
    catalog.data?.items
      .map((item) => item.owner?.display_name)
      .filter((value): value is string => Boolean(value)) ?? [],
  );

  return (
    <AppShell environmentLabel="Development · Seeded">
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
              <SimulatedDataBanner message={SEEDED_DATA_NOTE} />
              {catalog.dataUpdatedAt ? (
                <p className="text-xs text-[var(--muted)]" data-testid="last-successful-fetch">
                  Last successful update: {formatTimestamp(generatedAt)}
                </p>
              ) : null}
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

        {catalog.isPending ? <LoadingState label="Updating" rows={4} /> : null}
        {catalog.isError ? (
          <ErrorState
            title="Incident data unavailable"
            description="The development incidents API did not respond. Retry to load the seeded queue. Fixture rows are not substituted."
            onRetry={() => void catalog.refetch()}
          />
        ) : null}
        {filtered.isError ? (
          <ErrorState
            title="Filtered incident queue unavailable"
            description="The incident filter request failed. Fixture rows are not added."
            onRetry={() => void filtered.refetch()}
          />
        ) : null}
        {detail.isError ? (
          <ErrorState
            title="Incident record unavailable"
            description="The incident detail request failed. Related records are not invented."
            onRetry={() => void detail.refetch()}
          />
        ) : null}
        {catalog.isSuccess && (catalog.isFetching || filtered.isFetching || detail.isFetching) ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development incident queue"
              lastSuccessfulAt={generatedAt}
            />
          </div>
        ) : null}

        {catalog.isSuccess && snapshot ? (
          <div className="space-y-8">
            {section === "incidents" ? (
              <>
                <section aria-labelledby="incident-summary-heading">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2
                      id="incident-summary-heading"
                      className="font-heading text-xl font-bold text-[var(--text)]"
                    >
                      Response snapshot
                    </h2>
                    <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {snapshot.metrics.map((metric) => (
                      <SummaryMetric key={metric.id} metric={metric} />
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-[var(--muted)]">
                    Severity and lifecycle status stay separate. There is no aggregate security
                    score.
                  </p>
                </section>

                <Panel
                  title="Incident queue"
                  description="Development records returned by the incidents API. An alert is not an incident unless an analyst promotes it."
                >
                  <IncidentTable
                    incidents={visible}
                    total={
                      hasServerFilters
                        ? (filtered.data?.total ?? visible.length)
                        : catalog.data.total
                    }
                    selectedId={selected?.id ?? ""}
                    onSelect={setSelectedId}
                    filters={filters}
                    onFiltersChange={setFilters}
                    ownerOptions={ownerOptions}
                  />
                </Panel>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
                  <Panel
                    title={
                      selected ? `${selected.incidentId} · Response timeline` : "Response timeline"
                    }
                    className="h-full"
                  >
                    {selected ? (
                      <IncidentContext
                        incident={selected}
                        detail={detail.data ?? null}
                        timeline={timeline}
                        evidenceIds={evidence.map((item) => item.evidenceId)}
                      />
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No incident is stored for the current request.
                      </p>
                    )}
                  </Panel>
                  <Panel title="Workflow & interpretation" className="h-full">
                    <ul className="space-y-3">
                      {snapshot.workflowNotes.map((note) => (
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

            {section === "timeline" ? (
              <Panel
                title={selected ? `${selected.incidentId} · Timeline` : "Timeline"}
                description="Ordered events returned for the selected incident."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                <TimelineList events={timeline} />
              </Panel>
            ) : null}

            {section === "tasks" ? (
              <Panel
                title="Response tasks"
                description="TASK-NNNN records for the selected incident. Priority, due date, and description are not stored."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                {selected ? (
                  <IncidentTasksPanel
                    incidentId={selected.incidentId}
                    incidentStatus={selected.status}
                    openTaskCount={selected.openTaskCount}
                  />
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    No incident is stored for the current request.
                  </p>
                )}
              </Panel>
            ) : null}

            {section === "indicators" ? (
              <Panel
                title="Indicators"
                description="Indicators returned with the selected incident. Confidence is the stored value."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                <ul className="space-y-3" data-testid="incident-indicators">
                  {indicators.length === 0 ? (
                    <li className="text-sm text-[var(--muted)]">No indicators are stored.</li>
                  ) : null}
                  {indicators.map((item) => (
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
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
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
                      {evidence.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-[var(--muted)]">
                            No evidence is stored.
                          </td>
                        </tr>
                      ) : null}
                      {evidence.map((item) => (
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
                  {evidence.length === 0 ? (
                    <li className="text-sm text-[var(--muted)]">No evidence is stored.</li>
                  ) : null}
                  {evidence.map((item) => (
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
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function toIncidentQuery(filters: IncidentTableFilters): IncidentQuery {
  return {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.severity !== "all" ? { severity: filters.severity } : {}),
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.owner !== "all" ? { owner: filters.owner } : {}),
    ...(filters.containment !== "all" ? { containmentState: filters.containment } : {}),
  };
}

function uniqueOptions(values: string[]): IncidentFilterOption[] {
  return Array.from(new Set(values))
    .sort()
    .map((value) => ({ value, label: value }));
}

function IncidentContext({
  incident,
  detail,
  timeline,
  evidenceIds,
}: {
  incident: IncidentRecord;
  detail: IncidentDetailResponse | null;
  timeline: TimelineEvent[];
  evidenceIds: string[];
}) {
  const auth = useAuthStatus();
  const permissions = auth.user?.permissions ?? [];
  const canManage = permissions.includes("incident.manage");
  const canClose = permissions.includes("incident.close");
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
        <p className="text-[var(--muted)]">Edit incident</p>
        <div className="mt-2">
          <IncidentEditor
            incidentId={incident.incidentId}
            title={detail?.title ?? incident.title}
            severity={detail?.severity ?? incident.severity}
            status={detail?.status ?? incident.status}
            summary={detail?.summary ?? incident.summary}
            ownerLabel={incident.owner}
            updatedAt={detail?.updated_at ?? null}
            canManage={canManage}
            canClose={canClose}
          />
        </div>
      </div>
      <div>
        <p className="text-[var(--muted)]">Owner</p>
        <p className="mt-1 text-[var(--text)]">{incident.owner}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Affected assets</p>
        <p className="mt-1 text-[var(--text)]">
          {incident.assets.length > 0
            ? incident.assets.map((asset) => asset.hostname).join(", ")
            : "No affected assets are stored."}
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
            : "No related alerts are stored."}
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
            : "No timeline events are stored."}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Containment</p>
        <p className="mt-1 text-[var(--text)]">{incident.containment}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Response tasks</p>
        <p className="mt-1 text-[var(--text)]">
          {incident.openTaskCount === 0 && (detail?.tasks.length ?? 0) === 0
            ? "No response tasks have been created for this incident."
            : `${incident.openTaskCount} active`}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Task status does not automatically change the incident status.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Evidence</p>
        <p className="mt-1 text-[var(--text)]">
          {evidenceIds.length > 0 ? evidenceIds.join(", ") : "No evidence is stored."}
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
      {events.length === 0 ? (
        <li className="text-sm text-[var(--muted)]">No timeline events are stored.</li>
      ) : null}
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
