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
  SocAlertTable,
  type SocFilterOption,
  type SocTableFilters,
} from "@/features/soc/SocAlertTable";
import { mapSocInventory } from "@/features/soc/mapSoc";
import { useAlertCatalog, useAlertDetail, useAlertList } from "@/features/soc/useSocData";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { AlertQuery } from "@/services/api-types";
import type { SocAlert, SocSectionId } from "@/types/soc";

const sections: { id: SocSectionId; label: string }[] = [
  { id: "alerts", label: "Alert queue" },
  { id: "investigations", label: "Investigations" },
  { id: "detections", label: "Detection rules" },
  { id: "attack", label: "ATT&CK coverage" },
];

const emptyFilters: SocTableFilters = {
  search: "",
  severity: "all",
  status: "all",
  asset: "all",
  attack: "all",
};

export function SocPage() {
  const catalog = useAlertCatalog();
  const [section, setSection] = useState<SocSectionId>("alerts");
  const [selectedId, setSelectedId] = useState("");
  const [filters, setFilters] = useState<SocTableFilters>(emptyFilters);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const query = useMemo(
    () => toAlertQuery({ ...filters, search: deferredSearch }),
    [filters, deferredSearch],
  );
  const hasServerFilters = Object.keys(query).length > 0;
  const filtered = useAlertList(query, hasServerFilters);
  const generatedAt = catalog.dataUpdatedAt
    ? new Date(catalog.dataUpdatedAt).toISOString()
    : new Date().toISOString();
  const sourceItems = hasServerFilters ? (filtered.data?.items ?? []) : (catalog.data?.items ?? []);
  const selectedRow = sourceItems.find((item) => item.id === selectedId) ?? sourceItems[0];
  const detail = useAlertDetail(selectedRow?.id ?? "");
  const snapshot = catalog.data
    ? mapSocInventory(catalog.data.items, generatedAt, detail.data)
    : null;
  const view = mapSocInventory(sourceItems, generatedAt, detail.data);
  const visible = view.alerts;
  const selected = visible.find((item) => item.id === selectedRow?.id) ?? visible[0];
  const assetOptions = uniqueOptions(
    catalog.data?.items
      .map((item) => item.asset_hostname)
      .filter((value): value is string => Boolean(value)) ?? [],
  );
  const techniqueOptions: SocFilterOption[] = Array.from(
    new Map(
      (catalog.data?.items ?? [])
        .filter((item) => item.attack_technique_id)
        .map((item) => [
          item.attack_technique_id ?? "",
          {
            value: item.attack_technique_id ?? "",
            label: `${item.attack_tactic ?? "ATT&CK"} · ${item.attack_technique_id}`,
          },
        ]),
    ).values(),
  );

  return (
    <AppShell environmentLabel="Development · Seeded">
      <PageContainer data-testid="soc-page">
        <PageHeader
          title="SOC operations"
          description="Triage signals, preserve context, and investigate what matters."
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <Button
                type="button"
                disabled
                title="Investigations are not connected in this phase"
                aria-label="New investigation (not connected in this phase)"
              >
                New investigation
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
          aria-label="SOC sections"
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
                  "motion-control inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
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
            title="SOC queue unavailable"
            description="The development alerts API did not respond. Retry to load the seeded queue. Fixture rows are not substituted."
            onRetry={() => void catalog.refetch()}
          />
        ) : null}
        {filtered.isError ? (
          <ErrorState
            title="Filtered alert queue unavailable"
            description="The alert filter request failed. Fixture rows are not added."
            onRetry={() => void filtered.refetch()}
          />
        ) : null}
        {catalog.isSuccess && (catalog.isFetching || filtered.isFetching || detail.isFetching) ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development alert queue"
              lastSuccessfulAt={generatedAt}
            />
          </div>
        ) : null}

        {catalog.isSuccess && snapshot ? (
          <div key={section} className="motion-panel space-y-8">
            {section === "alerts" ? (
              <>
                <section aria-labelledby="soc-summary-heading">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2
                      id="soc-summary-heading"
                      className="font-heading text-xl font-bold text-[var(--text)]"
                    >
                      Queue snapshot
                    </h2>
                    <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {snapshot.metrics.map((metric) => (
                      <SummaryMetric key={metric.id} metric={metric} />
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-[var(--muted)]">
                    Wazuh remains the SIEM of record. This queue is selected alert metadata. There
                    is no aggregate security score.
                  </p>
                </section>

                <Panel
                  title="Alert triage queue"
                  description="Development records returned by the alerts API. Selected metadata only. Not a raw Wazuh event index."
                >
                  <SocAlertTable
                    alerts={visible}
                    total={
                      hasServerFilters
                        ? (filtered.data?.total ?? visible.length)
                        : catalog.data.total
                    }
                    selectedId={selected?.id ?? ""}
                    onSelect={setSelectedId}
                    filters={filters}
                    onFiltersChange={setFilters}
                    assetOptions={assetOptions}
                    techniqueOptions={techniqueOptions}
                  />
                </Panel>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
                  <Panel
                    title={selected ? `Triage context · ${selected.alertId}` : "Triage context"}
                    className="h-full"
                  >
                    {selected ? <TriageContext alert={selected} /> : null}
                  </Panel>
                  <Panel title="Workflow & interpretation" className="h-full">
                    <ul className="space-y-3">
                      {view.workflowNotes.map((note) => (
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

            {section === "investigations" ? (
              <Panel
                title="Investigations"
                description="Analyst workflow state. Promoting an investigation to an incident is not connected."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                <ul className="space-y-3" data-testid="soc-investigations">
                  {view.investigations.length === 0 ? (
                    <li className="text-sm text-[var(--muted)]">No investigations are stored.</li>
                  ) : null}
                  {view.investigations.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                    >
                      <p className="font-medium text-[var(--text)]">
                        {item.investigationId} · {item.title}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.alertId} · {item.assetHostname} · {item.status}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.summary}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            {section === "detections" ? (
              <Panel
                title="Detection rules"
                description="Detection status returned with these alerts. A Sigma source is not stored."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <caption className="sr-only">
                      Detection summaries with Sigma source, Wazuh status, ATT&CK mapping, and
                      validation result
                    </caption>
                    <thead className="text-[var(--muted)]">
                      <tr>
                        {[
                          "Detection",
                          "Sigma source",
                          "Wazuh status",
                          "ATT&CK",
                          "Last validation",
                          "Result",
                        ].map((heading) => (
                          <th key={heading} scope="col" className="px-3 py-3 font-medium">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {view.detections.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-[var(--muted)]">
                            No detections are stored.
                          </td>
                        </tr>
                      ) : null}
                      {view.detections.map((item) => (
                        <tr key={item.id} className="border-t border-[var(--border)]">
                          <td className="px-3 py-3 text-[var(--text)]">
                            {item.detectionId}
                            <span className="mt-1 block text-xs text-[var(--muted)]">
                              {item.name}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">{item.sigmaSource}</td>
                          <td className="px-3 py-3 text-[var(--muted)]">{item.wazuhStatus}</td>
                          <td className="px-3 py-3 text-[var(--text)]">
                            {item.attackTechniqueId} {item.attackTechniqueName}
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">{item.lastValidation}</td>
                          <td className="px-3 py-3 text-[var(--muted)]">{item.validationResult}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-3 md:hidden" data-testid="soc-detections">
                  {view.detections.length === 0 ? (
                    <li className="text-sm text-[var(--muted)]">No detections are stored.</li>
                  ) : null}
                  {view.detections.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                    >
                      <p className="font-medium text-[var(--text)]">
                        {item.detectionId} · {item.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.attackTechniqueId} · {item.validationResult}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            {section === "attack" ? (
              <Panel
                title="ATT&CK coverage"
                description={`${view.attackVersion}. These rows are techniques returned with these alerts, not organizational coverage.`}
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                <p className="mb-4 text-sm text-[var(--muted)]">
                  A single detection does not imply full organizational ATT&CK coverage.
                </p>
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <caption className="sr-only">
                      ATT&CK techniques returned with these alerts, with telemetry, detection, and
                      validation status
                    </caption>
                    <thead className="text-[var(--muted)]">
                      <tr>
                        {[
                          "Technique",
                          "Tactic",
                          "Telemetry",
                          "Detection",
                          "Validation",
                          "Last validated",
                        ].map((heading) => (
                          <th key={heading} scope="col" className="px-3 py-3 font-medium">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {view.attackCoverage.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-[var(--muted)]">
                            No ATT&CK mappings are stored.
                          </td>
                        </tr>
                      ) : null}
                      {view.attackCoverage.map((item) => (
                        <tr key={item.techniqueId} className="border-t border-[var(--border)]">
                          <td className="px-3 py-3 text-[var(--text)]">
                            {item.techniqueId}
                            <span className="mt-1 block text-xs text-[var(--muted)]">
                              {item.techniqueName}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">{item.tactic}</td>
                          <td className="px-3 py-3 text-[var(--muted)]">
                            {item.telemetryAvailable}
                          </td>
                          <td className="px-3 py-3 text-[var(--text)]">{item.detectionId}</td>
                          <td className="px-3 py-3 text-[var(--muted)]">{item.validationStatus}</td>
                          <td className="px-3 py-3 text-[var(--muted)]">{item.lastValidated}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-3 md:hidden" data-testid="soc-attack">
                  {view.attackCoverage.length === 0 ? (
                    <li className="text-sm text-[var(--muted)]">No ATT&CK mappings are stored.</li>
                  ) : null}
                  {view.attackCoverage.map((item) => (
                    <li
                      key={item.techniqueId}
                      className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                    >
                      <p className="font-medium text-[var(--text)]">
                        {item.techniqueId} · {item.techniqueName}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.tactic} · {item.validationStatus}
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

function toAlertQuery(filters: SocTableFilters): AlertQuery {
  return {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.severity !== "all" ? { severity: filters.severity } : {}),
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.asset !== "all" ? { asset: filters.asset } : {}),
    ...(filters.attack !== "all" ? { attackTechnique: filters.attack } : {}),
  };
}

function uniqueOptions(values: string[]): SocFilterOption[] {
  return Array.from(new Set(values))
    .sort()
    .map((value) => ({ value, label: value }));
}

function TriageContext({ alert }: { alert: SocAlert }) {
  return (
    <div className="space-y-4 text-sm" data-testid="triage-context">
      <div>
        <p className="text-[var(--muted)]">Detection</p>
        <p className="mt-1 text-[var(--text)]">
          {alert.detectionId} · {alert.detectionName}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Severity and time</p>
        <p className="mt-1 text-[var(--text)]">
          {alert.severity} · {alert.timestampLabel} · {alert.freshness}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Observed behavior</p>
        <p className="mt-1 text-[var(--text)]">{alert.observedBehavior}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Affected asset</p>
        <p className="mt-1 text-[var(--text)]">
          {alert.assetHostname}
          {alert.assetSlug ? (
            <>
              {" "}
              ·{" "}
              <Link
                to={`/assets/${alert.assetSlug}`}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--accent)]"
              >
                Open asset
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Identity</p>
        <p className="mt-1 text-[var(--text)]">{alert.account ?? "No account in this alert."}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Telemetry source</p>
        <p className="mt-1 text-[var(--text)]">{alert.telemetrySource}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">ATT&CK mapping</p>
        <p className="mt-1 text-[var(--text)]">
          {alert.attackTechniqueId} {alert.attackTechniqueName} · {alert.attackTactic}. Analyst
          validation required.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Investigation</p>
        <p className="mt-1 text-[var(--text)]">
          {alert.investigationId
            ? `${alert.investigationId} · ${alert.status}`
            : "No investigation is stored."}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Analyst context</p>
        <p className="mt-1 text-[var(--text)]">{alert.analystContext}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Next action</p>
        <p className="mt-1 text-[var(--text)]">{alert.nextAction}</p>
      </div>
    </div>
  );
}
