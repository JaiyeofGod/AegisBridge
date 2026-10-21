import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";

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
  mapCyberRangeSummary,
  mapLabDetection,
  mapLabScenario,
  mapLabSystem,
  mapLabTelemetry,
  mapLabZone,
  type LabSystemView,
} from "@/features/cyber-range/mapCyberRange";
import { RangeTopology } from "@/features/cyber-range/RangeTopology";
import {
  useCyberRangeSummary,
  useLabDetectionCatalog,
  useLabDetectionList,
  useLabScenarioCatalog,
  useLabScenarioDetail,
  useLabScenarioList,
  useLabSystemCatalog,
  useLabSystemDetail,
  useLabSystemList,
  useLabTelemetry,
  useLabZones,
} from "@/features/cyber-range/useCyberRangeData";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { LabDetectionQuery, LabScenarioQuery, LabSystemQuery } from "@/services/api-types";
import type { RangeSectionId } from "@/types/cyber-range";

const sections: { id: RangeSectionId; label: string }[] = [
  { id: "topology", label: "Topology" },
  { id: "segments", label: "Segments" },
  { id: "scenarios", label: "Scenarios" },
  { id: "telemetry", label: "Telemetry" },
  { id: "detections", label: "Detections" },
];

const selectClass =
  "min-h-11 min-w-[140px] rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const emptySystemFilters = {
  search: "",
  zone: "all",
  role: "all",
  telemetryStatus: "all",
  observedState: "all",
};

const emptyScenarioFilters = {
  search: "",
  status: "all",
  category: "all",
  attackTechnique: "all",
};

const emptyDetectionFilters = {
  search: "",
  validationState: "all",
  attackTechnique: "all",
  dataSource: "all",
};

export function CyberRangePage() {
  const summary = useCyberRangeSummary();
  const zonesQuery = useLabZones();
  const systemCatalog = useLabSystemCatalog();
  const scenarioCatalog = useLabScenarioCatalog();
  const telemetryQuery = useLabTelemetry();
  const detectionCatalog = useLabDetectionCatalog();

  const [section, setSection] = useState<RangeSectionId>("topology");
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [systemFilters, setSystemFilters] = useState(emptySystemFilters);
  const [scenarioFilters, setScenarioFilters] = useState(emptyScenarioFilters);
  const [detectionFilters, setDetectionFilters] = useState(emptyDetectionFilters);

  const deferredSystemSearch = useDeferredValue(systemFilters.search.trim());
  const deferredScenarioSearch = useDeferredValue(scenarioFilters.search.trim());
  const deferredDetectionSearch = useDeferredValue(detectionFilters.search.trim());

  const systemQuery = buildSystemQuery({ ...systemFilters, search: deferredSystemSearch });
  const scenarioQuery = buildScenarioQuery({
    ...scenarioFilters,
    search: deferredScenarioSearch,
  });
  const detectionQuery = buildDetectionQuery({
    ...detectionFilters,
    search: deferredDetectionSearch,
  });

  const hasSystemFilters = Object.keys(systemQuery).length > 0;
  const hasScenarioFilters = Object.keys(scenarioQuery).length > 0;
  const hasDetectionFilters = Object.keys(detectionQuery).length > 0;

  const filteredSystems = useLabSystemList(systemQuery, hasSystemFilters);
  const filteredScenarios = useLabScenarioList(scenarioQuery, hasScenarioFilters);
  const filteredDetections = useLabDetectionList(detectionQuery, hasDetectionFilters);

  const systemItems = (
    hasSystemFilters ? (filteredSystems.data?.items ?? []) : (systemCatalog.data?.items ?? [])
  ).map(mapLabSystem);
  const scenarioItems = (
    hasScenarioFilters ? (filteredScenarios.data?.items ?? []) : (scenarioCatalog.data?.items ?? [])
  ).map(mapLabScenario);
  const detectionItems = (
    hasDetectionFilters
      ? (filteredDetections.data?.items ?? [])
      : (detectionCatalog.data?.items ?? [])
  ).map(mapLabDetection);
  const telemetryItems = (telemetryQuery.data?.items ?? []).map(mapLabTelemetry);

  const zoneItems = useMemo(() => {
    const systemsByZone = new Map<string, string[]>();
    for (const system of systemCatalog.data?.items ?? []) {
      const zoneId = system.zone.id;
      const current = systemsByZone.get(zoneId) ?? [];
      current.push(system.id);
      systemsByZone.set(zoneId, current);
    }
    return (zonesQuery.data?.items ?? []).map((zone) =>
      mapLabZone(zone, systemsByZone.get(zone.id) ?? []),
    );
  }, [zonesQuery.data?.items, systemCatalog.data?.items]);

  useEffect(() => {
    if (!selectedSystemId && systemItems[0]) setSelectedSystemId(systemItems[0].id);
  }, [systemItems, selectedSystemId]);

  useEffect(() => {
    if (!selectedScenarioId && scenarioItems[0]) setSelectedScenarioId(scenarioItems[0].id);
  }, [scenarioItems, selectedScenarioId]);

  const systemDetail = useLabSystemDetail(selectedSystemId);
  const scenarioDetail = useLabScenarioDetail(selectedScenarioId);

  const selectedSystem =
    (systemDetail.data ? mapLabSystem(systemDetail.data) : null) ??
    systemItems.find((item) => item.id === selectedSystemId) ??
    null;
  const selectedScenario =
    (scenarioDetail.data ? mapLabScenario(scenarioDetail.data) : null) ??
    scenarioItems.find((item) => item.id === selectedScenarioId) ??
    null;

  const mapped = summary.data ? mapCyberRangeSummary(summary.data) : null;
  const generatedAt = summary.dataUpdatedAt
    ? new Date(summary.dataUpdatedAt).toISOString()
    : new Date().toISOString();

  const roleOptions = useMemo(() => {
    return Array.from(new Set((systemCatalog.data?.items ?? []).map((item) => item.role)))
      .sort()
      .map((value) => ({ value, label: value }));
  }, [systemCatalog.data?.items]);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set((scenarioCatalog.data?.items ?? []).map((item) => item.category)))
      .sort()
      .map((value) => ({ value, label: value }));
  }, [scenarioCatalog.data?.items]);

  const scenarioTechniqueOptions = useMemo(() => {
    const values = (scenarioCatalog.data?.items ?? []).flatMap((item) =>
      item.attack_techniques.map((technique) => technique.id),
    );
    return Array.from(new Set(values))
      .sort()
      .map((value) => ({ value, label: value }));
  }, [scenarioCatalog.data?.items]);

  const detectionTechniqueOptions = useMemo(() => {
    const values = (detectionCatalog.data?.items ?? []).flatMap((item) =>
      item.attack_techniques.map((technique) => technique.id),
    );
    return Array.from(new Set(values))
      .sort()
      .map((value) => ({ value, label: value }));
  }, [detectionCatalog.data?.items]);

  const dataSourceOptions = useMemo(() => {
    const values = (detectionCatalog.data?.items ?? [])
      .map((item) => item.data_source)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(values))
      .sort()
      .map((value) => ({ value, label: value }));
  }, [detectionCatalog.data?.items]);

  const refreshing =
    summary.isFetching ||
    zonesQuery.isFetching ||
    systemCatalog.isFetching ||
    filteredSystems.isFetching ||
    systemDetail.isFetching ||
    scenarioCatalog.isFetching ||
    filteredScenarios.isFetching ||
    scenarioDetail.isFetching ||
    telemetryQuery.isFetching ||
    detectionCatalog.isFetching ||
    filteredDetections.isFetching;

  return (
    <AppShell environmentLabel="Development · Seeded">
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

        {summary.isPending ? <LoadingState label="Updating" rows={4} /> : null}
        {summary.isError ? (
          <ErrorState
            title="Cyber range data unavailable"
            description="The development cyber-range API did not respond. Retry to load the seeded catalog. Fixture rows are not substituted."
            lastSuccessfulAt={summary.dataUpdatedAt ? generatedAt : undefined}
            onRetry={() => void summary.refetch()}
          />
        ) : null}
        {summary.isSuccess && refreshing ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development cyber-range records"
              lastSuccessfulAt={generatedAt}
            />
          </div>
        ) : null}

        {summary.isSuccess && mapped ? (
          <div className="space-y-8">
            {section === "topology" ? (
              <>
                <section aria-labelledby="range-summary-heading">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2
                      id="range-summary-heading"
                      className="font-heading text-xl font-bold text-[var(--text)]"
                    >
                      Range snapshot
                    </h2>
                    <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {mapped.metrics.map((metric) => (
                      <SummaryMetric key={metric.id} metric={metric} />
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-[var(--muted)]">
                    Lab Bridge: {summary.data.lab_bridge_status}. Last successful lab sync:{" "}
                    {summary.data.last_successful_lab_sync_at
                      ? formatTimestamp(summary.data.last_successful_lab_sync_at)
                      : "Not recorded"}
                    . Scenarios running: {summary.data.scenarios_running_count}. Detection coverage:{" "}
                    {summary.data.detection_coverage_count}. There is no aggregate security score.
                  </p>
                </section>

                <Panel
                  title="Segmented topology"
                  description="2D plan of the five approved zones. Catalog metadata only. Not live reachability and not a 3D view."
                >
                  {zonesQuery.isPending || systemCatalog.isPending ? (
                    <LoadingState label="Updating" rows={2} />
                  ) : null}
                  {zonesQuery.isError || systemCatalog.isError ? (
                    <ErrorState
                      title="Topology unavailable"
                      description="The zone or system request failed. Fixture topology is not substituted."
                      onRetry={() => {
                        void zonesQuery.refetch();
                        void systemCatalog.refetch();
                      }}
                    />
                  ) : null}
                  {zonesQuery.isSuccess && systemCatalog.isSuccess ? (
                    <RangeTopology
                      zones={zoneItems}
                      systems={
                        hasSystemFilters
                          ? systemItems
                          : (systemCatalog.data.items.map(mapLabSystem) ?? [])
                      }
                      selectedId={selectedSystem?.id ?? ""}
                      onSelect={setSelectedSystemId}
                    />
                  ) : null}
                </Panel>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
                  <Panel
                    title={
                      selectedSystem ? `Selected · ${selectedSystem.hostname}` : "Selected system"
                    }
                    className="h-full"
                  >
                    {selectedSystem ? (
                      <SystemContext
                        system={selectedSystem}
                        detailPending={systemDetail.isPending}
                      />
                    ) : (
                      <p className="text-sm text-[var(--muted)]">No lab system is selected.</p>
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

            {section === "segments" ? (
              <Panel
                title="Segments"
                description="Approved lab networks. Isolation is policy, not an observed attack or live reachability."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                {zonesQuery.isPending ? <LoadingState label="Updating" rows={2} /> : null}
                {zonesQuery.isError ? (
                  <ErrorState
                    title="Zones unavailable"
                    description="The zone request failed. Fixture segments are not substituted."
                    onRetry={() => void zonesQuery.refetch()}
                  />
                ) : null}
                {zonesQuery.isSuccess && zoneItems.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No zones are stored.</p>
                ) : null}
                {zonesQuery.isSuccess && zoneItems.length > 0 ? (
                  <ul className="space-y-3" data-testid="range-segments">
                    {zoneItems.map((segment) => (
                      <li
                        key={segment.id}
                        className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                      >
                        <p className="font-medium text-[var(--text)]">
                          {segment.id} · {segment.cidr}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{segment.purpose}</p>
                        <p className="mt-1 text-sm text-[var(--text)]">
                          Gateway {segment.gateway} · Status {segment.statusLabel} · Observed{" "}
                          {segment.observedLabel}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Systems:{" "}
                          {segment.systemIds.length > 0 ? segment.systemIds.join(", ") : "None"}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{segment.isolationNotes}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            ) : null}

            {section === "scenarios" ? (
              <>
                <Panel
                  title="Scenarios"
                  description="Catalog only. Starting a run is not connected. No execute, start, or stop action exists."
                  action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
                >
                  {scenarioCatalog.isPending && !hasScenarioFilters ? (
                    <LoadingState label="Updating" rows={2} />
                  ) : null}
                  {scenarioCatalog.isError && !hasScenarioFilters ? (
                    <ErrorState
                      title="Scenarios unavailable"
                      description="The scenario request failed. Fixture scenarios are not substituted."
                      onRetry={() => void scenarioCatalog.refetch()}
                    />
                  ) : null}
                  <FilterBar
                    searchId="scenario-search"
                    searchValue={scenarioFilters.search}
                    onSearchChange={(search) => setScenarioFilters({ ...scenarioFilters, search })}
                  >
                    <FilterSelect
                      id="scenario-status"
                      label="Status"
                      value={scenarioFilters.status}
                      onChange={(status) => setScenarioFilters({ ...scenarioFilters, status })}
                      options={[
                        { value: "planned", label: "Planned" },
                        { value: "ready", label: "Ready" },
                        { value: "simulated", label: "Simulated" },
                        { value: "validated", label: "Validated" },
                      ]}
                    />
                    <FilterSelect
                      id="scenario-category"
                      label="Category"
                      value={scenarioFilters.category}
                      onChange={(category) => setScenarioFilters({ ...scenarioFilters, category })}
                      options={categoryOptions}
                    />
                    <FilterSelect
                      id="scenario-technique"
                      label="ATT&CK technique"
                      value={scenarioFilters.attackTechnique}
                      onChange={(attackTechnique) =>
                        setScenarioFilters({ ...scenarioFilters, attackTechnique })
                      }
                      options={scenarioTechniqueOptions}
                    />
                  </FilterBar>
                  <div className="mt-4 overflow-x-auto" data-testid="range-scenarios">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <caption className="sr-only">
                        Lab scenario catalog with targets, detections, status, and last run
                      </caption>
                      <thead className="text-[var(--muted)]">
                        <tr>
                          {[
                            "Scenario",
                            "Category",
                            "Targets",
                            "Detections",
                            "ATT&CK",
                            "Status",
                            "Last run",
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
                        {scenarioItems.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-8 text-[var(--muted)]">
                              {hasScenarioFilters
                                ? "No scenarios match the current filters."
                                : "No scenarios are stored."}
                            </td>
                          </tr>
                        ) : (
                          scenarioItems.map((item) => (
                            <tr key={item.id} className="border-t border-[var(--border)]">
                              <td className="px-3 py-3">
                                <button
                                  type="button"
                                  aria-pressed={selectedScenarioId === item.id}
                                  onClick={() => setSelectedScenarioId(item.id)}
                                  className="inline-flex min-h-11 flex-col items-start justify-center text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                                >
                                  <span className="font-medium text-[var(--text)]">{item.id}</span>
                                  <span className="text-xs text-[var(--muted)]">{item.name}</span>
                                </button>
                              </td>
                              <td className="px-3 py-3 text-[var(--muted)]">{item.category}</td>
                              <td className="px-3 py-3 text-[var(--muted)]">
                                {item.expectedSystems}
                              </td>
                              <td className="px-3 py-3 text-[var(--muted)]">
                                {item.expectedDetections}
                              </td>
                              <td className="px-3 py-3 text-[var(--muted)]">
                                {item.attackTechniques}
                              </td>
                              <td className="px-3 py-3 text-[var(--text)]">{item.statusLabel}</td>
                              <td className="px-3 py-3 text-[var(--muted)]">{item.lastRunAt}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Running scenarios: {summary.data.scenarios_running_count}. Last run stays “Not
                    run” when no execution row is stored.
                  </p>
                </Panel>
                <Panel title="Scenario detail">
                  {selectedScenario ? (
                    <div className="space-y-4 text-sm" data-testid="scenario-detail">
                      {scenarioDetail.isPending ? (
                        <p className="text-[var(--muted)]">Updating scenario detail…</p>
                      ) : null}
                      <p className="text-[var(--text)]">
                        {selectedScenario.id} · {selectedScenario.name}
                      </p>
                      <p className="text-[var(--muted)]">{selectedScenario.objective}</p>
                      <p className="text-[var(--text)]">
                        Status {selectedScenario.statusLabel} ({selectedScenario.status}). Last run{" "}
                        {selectedScenario.lastRunAt}.
                      </p>
                      <p className="text-[var(--muted)]">
                        Expected telemetry: {selectedScenario.expectedTelemetry}
                      </p>
                      <p className="text-[var(--text)]">{selectedScenario.safetyNotes}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">No scenario is selected.</p>
                  )}
                </Panel>
              </>
            ) : null}

            {section === "telemetry" ? (
              <Panel
                title="Telemetry"
                description="Expected sources only. Wazuh and Suricata remain not_connected unless stored otherwise."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                {telemetryQuery.isPending ? <LoadingState label="Updating" rows={2} /> : null}
                {telemetryQuery.isError ? (
                  <ErrorState
                    title="Telemetry unavailable"
                    description="The telemetry request failed. Fixture telemetry is not substituted."
                    onRetry={() => void telemetryQuery.refetch()}
                  />
                ) : null}
                {telemetryQuery.isSuccess && telemetryItems.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No telemetry rows are stored.</p>
                ) : null}
                {telemetryQuery.isSuccess && telemetryItems.length > 0 ? (
                  <ul className="space-y-3" data-testid="range-telemetry">
                    {telemetryItems.map((item) => (
                      <li
                        key={item.systemId}
                        className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                      >
                        <p className="font-medium text-[var(--text)]">
                          {item.systemId} · {item.hostname}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {item.telemetrySource} · {item.expected} · {item.statusLabel} (
                          {item.status})
                        </p>
                        <p className="mt-1 text-sm text-[var(--text)]">
                          Last seen {item.lastSeenAt} · Freshness {item.freshness}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{item.semantics}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Telemetry active {summary.data.telemetry_active_count} / expected{" "}
                  {summary.data.telemetry_expected_count}. No connected feed is implied.
                </p>
              </Panel>
            ) : null}

            {section === "detections" ? (
              <Panel
                title="Detections"
                description="Lab detection catalog metadata. Validation has not been performed unless stored."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                {detectionCatalog.isPending && !hasDetectionFilters ? (
                  <LoadingState label="Updating" rows={2} />
                ) : null}
                {detectionCatalog.isError && !hasDetectionFilters ? (
                  <ErrorState
                    title="Detections unavailable"
                    description="The detection request failed. Fixture detections are not substituted."
                    onRetry={() => void detectionCatalog.refetch()}
                  />
                ) : null}
                <FilterBar
                  searchId="detection-search"
                  searchValue={detectionFilters.search}
                  onSearchChange={(search) => setDetectionFilters({ ...detectionFilters, search })}
                >
                  <FilterSelect
                    id="detection-validation"
                    label="Validation state"
                    value={detectionFilters.validationState}
                    onChange={(validationState) =>
                      setDetectionFilters({ ...detectionFilters, validationState })
                    }
                    options={[
                      { value: "not_validated", label: "Not validated" },
                      { value: "not_run", label: "Not run" },
                      { value: "partial", label: "Partial" },
                      { value: "validated", label: "Validated" },
                    ]}
                  />
                  <FilterSelect
                    id="detection-technique"
                    label="ATT&CK technique"
                    value={detectionFilters.attackTechnique}
                    onChange={(attackTechnique) =>
                      setDetectionFilters({ ...detectionFilters, attackTechnique })
                    }
                    options={detectionTechniqueOptions}
                  />
                  <FilterSelect
                    id="detection-source"
                    label="Data source"
                    value={detectionFilters.dataSource}
                    onChange={(dataSource) =>
                      setDetectionFilters({ ...detectionFilters, dataSource })
                    }
                    options={dataSourceOptions}
                  />
                </FilterBar>
                <ul className="mt-4 space-y-3" data-testid="range-detections">
                  {detectionItems.length === 0 ? (
                    <li className="text-sm text-[var(--muted)]">
                      {hasDetectionFilters
                        ? "No detections match the current filters."
                        : "No detections are stored."}
                    </li>
                  ) : (
                    detectionItems.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                      >
                        <p className="font-medium text-[var(--text)]">
                          {item.id} · {item.name}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{item.description}</p>
                        <p className="mt-1 text-sm text-[var(--text)]">
                          {item.attackTechniques} · {item.dataSource}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Sigma {item.sigmaReference} · Wazuh {item.wazuhStatus}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text)]">
                          Validation {item.validationLabel} ({item.validationState}) · Last
                          validation {item.lastValidatedAt}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </Panel>
            ) : null}

            {section === "topology" || section === "segments" ? (
              <Panel
                title="System filters"
                description="Supported catalog filters only. Expected systems are not converted into active systems."
              >
                <FilterBar
                  searchId="system-search"
                  searchValue={systemFilters.search}
                  onSearchChange={(search) => setSystemFilters({ ...systemFilters, search })}
                >
                  <FilterSelect
                    id="system-zone"
                    label="Zone"
                    value={systemFilters.zone}
                    onChange={(zone) => setSystemFilters({ ...systemFilters, zone })}
                    options={zoneItems.map((zone) => ({ value: zone.id, label: zone.id }))}
                  />
                  <FilterSelect
                    id="system-role"
                    label="Role"
                    value={systemFilters.role}
                    onChange={(role) => setSystemFilters({ ...systemFilters, role })}
                    options={roleOptions}
                  />
                  <FilterSelect
                    id="system-telemetry"
                    label="Telemetry status"
                    value={systemFilters.telemetryStatus}
                    onChange={(telemetryStatus) =>
                      setSystemFilters({ ...systemFilters, telemetryStatus })
                    }
                    options={[
                      { value: "not_connected", label: "Not connected" },
                      { value: "not_reporting", label: "Not reporting" },
                      { value: "simulated", label: "Simulated" },
                      { value: "reference_only", label: "Reference only" },
                    ]}
                  />
                  <FilterSelect
                    id="system-observed"
                    label="Observed state"
                    value={systemFilters.observedState}
                    onChange={(observedState) =>
                      setSystemFilters({ ...systemFilters, observedState })
                    }
                    options={[
                      { value: "not_observed", label: "Not observed" },
                      { value: "simulated_reporting", label: "Simulated reporting" },
                      { value: "simulated_stopped", label: "Simulated stopped" },
                      { value: "reference_only", label: "Reference only" },
                    ]}
                  />
                </FilterBar>
                {hasSystemFilters ? (
                  <p className="mt-3 text-xs text-[var(--muted)]" data-testid="system-filter-note">
                    Showing {systemItems.length} filtered system
                    {systemItems.length === 1 ? "" : "s"}.
                  </p>
                ) : null}
              </Panel>
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function SystemContext({
  system,
  detailPending,
}: {
  system: LabSystemView;
  detailPending: boolean;
}) {
  return (
    <div className="space-y-4 text-sm" data-testid="range-context">
      {detailPending ? <p className="text-[var(--muted)]">Updating system detail…</p> : null}
      <div>
        <p className="text-[var(--muted)]">System</p>
        <p className="mt-1 text-[var(--text)]">
          {system.id} · {system.hostname} · {system.zoneId} · {system.ipAddress}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Role and platform</p>
        <p className="mt-1 text-[var(--text)]">
          {system.role}. Platform {system.platform}. Origin {system.sourceOrigin}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Expected versus observed</p>
        <p className="mt-1 text-[var(--text)]">
          Expected {system.expectedLabel} ({system.expectedState}). Observed {system.observedLabel}{" "}
          ({system.observedState}). Expected systems are not active systems. Last seen{" "}
          {system.lastSeenAt}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Telemetry</p>
        <p className="mt-1 text-[var(--text)]">
          {system.telemetrySource}. Status {system.telemetryLabel} ({system.telemetryStatus}).
          Freshness {system.telemetryFreshness}. {system.telemetrySemantics}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Notes</p>
        <p className="mt-1 text-[var(--text)]">{system.notes}</p>
      </div>
    </div>
  );
}

function FilterBar({
  searchId,
  searchValue,
  onSearchChange,
  children,
}: {
  searchId: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
      <div className="min-w-[200px] flex-1">
        <label className="mb-2 block text-sm font-medium text-[var(--text)]" htmlFor={searchId}>
          Search records
        </label>
        <input
          id={searchId}
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search records…"
          className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        />
      </div>
      {children}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[var(--text)]" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function buildSystemQuery(filters: typeof emptySystemFilters & { search: string }): LabSystemQuery {
  const query: LabSystemQuery = {};
  if (filters.search) query.search = filters.search;
  if (filters.zone !== "all") query.zone = filters.zone;
  if (filters.role !== "all") query.role = filters.role;
  if (filters.telemetryStatus !== "all") query.telemetryStatus = filters.telemetryStatus;
  if (filters.observedState !== "all") query.observedState = filters.observedState;
  return query;
}

function buildScenarioQuery(
  filters: typeof emptyScenarioFilters & { search: string },
): LabScenarioQuery {
  const query: LabScenarioQuery = {};
  if (filters.search) query.search = filters.search;
  if (filters.status !== "all") query.status = filters.status;
  if (filters.category !== "all") query.category = filters.category;
  if (filters.attackTechnique !== "all") query.attackTechnique = filters.attackTechnique;
  return query;
}

function buildDetectionQuery(
  filters: typeof emptyDetectionFilters & { search: string },
): LabDetectionQuery {
  const query: LabDetectionQuery = {};
  if (filters.search) query.search = filters.search;
  if (filters.validationState !== "all") query.validationState = filters.validationState;
  if (filters.attackTechnique !== "all") query.attackTechnique = filters.attackTechnique;
  if (filters.dataSource !== "all") query.dataSource = filters.dataSource;
  return query;
}
