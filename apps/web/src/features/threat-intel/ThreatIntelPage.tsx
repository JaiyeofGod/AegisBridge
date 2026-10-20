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
import { ThreatIndicatorTable } from "@/features/threat-intel/ThreatIndicatorTable";
import { useThreatIntelData } from "@/features/threat-intel/useThreatIntelData";
import { cn } from "@/lib/cn";
import type { IntelSectionId, ThreatIndicator } from "@/types/threat-intel";

const sections: { id: IntelSectionId; label: string }[] = [
  { id: "indicators", label: "Indicators" },
  { id: "advisories", label: "Advisories" },
  { id: "enrichment", label: "Enrichment" },
  { id: "sources", label: "Sources" },
];

export function ThreatIntelPage() {
  const queue = useThreatIntelData();
  const [section, setSection] = useState<IntelSectionId>("indicators");
  const [selectedId, setSelectedId] = useState("ioc-401");
  const selected =
    queue.data.indicators.find((item) => item.id === selectedId) ?? queue.data.indicators[0];

  return (
    <AppShell environmentLabel={queue.data.environmentLabel}>
      <PageContainer data-testid="threat-intel-page">
        <PageHeader
          title="Threat intelligence"
          description="Turn indicators and advisories into relevant investigative context."
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <Button
                type="button"
                disabled
                title="Indicator intake is not connected in this phase"
                aria-label="Add indicator (not connected in this phase)"
              >
                Add indicator
              </Button>
              <SimulatedDataBanner message={queue.data.snapshotLabel} />
            </div>
          }
        />

        <div
          role="tablist"
          aria-label="Threat intelligence sections"
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
          {section === "indicators" && selected ? (
            <>
              <section aria-labelledby="intel-summary-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2
                    id="intel-summary-heading"
                    className="font-heading text-xl font-bold text-[var(--text)]"
                  >
                    Intelligence snapshot
                  </h2>
                  <StatusBadge label="SIMULATED" tone="warning" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {queue.data.metrics.map((metric) => (
                    <SummaryMetric key={metric.id} metric={metric} />
                  ))}
                </div>
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Confidence and freshness stay separate. There is no aggregate threat or security
                  score.
                </p>
              </section>

              <Panel
                title="Indicator workspace"
                description="Sample indicators from the simulated lab. Reserved example addresses and domains."
              >
                <ThreatIndicatorTable
                  indicators={queue.data.indicators}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </Panel>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
                <Panel title="Indicator context" className="h-full">
                  <IndicatorContext indicator={selected} />
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

          {section === "advisories" ? (
            <Panel
              title="Advisories"
              description="Catalog and campaign notes for review. Not live feed results."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <ul className="space-y-3" data-testid="intel-advisories">
                {queue.data.advisories.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {item.advisoryId} · {item.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.intelId} · {item.source} · {item.confidence} confidence ·{" "}
                      {item.freshness} · {item.status}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text)]">{item.analystContext}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {item.relatedCve ?? "No CVE"} · {item.relatedAsset ?? "No asset"} ·{" "}
                      {item.relatedRecord ?? "No related record"}
                      {item.attackMapping ? ` · ${item.attackMapping}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {section === "enrichment" ? (
            <Panel
              title="Enrichment history"
              description="Contextual links only. Vulnerability, incident, detection, and asset modules are not rebuilt here."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <ul className="space-y-3" data-testid="intel-enrichment">
                {queue.data.enrichment.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">{item.intelId}</p>
                    <p className="mt-1 text-sm text-[var(--text)]">{item.summary}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.targets}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {section === "sources" ? (
            <Panel
              title="Sources"
              description="Planned, simulated, and later connections. No live API calls in this phase."
              action={<StatusBadge label="SIMULATED" tone="warning" />}
            >
              <ul className="space-y-3" data-testid="intel-sources">
                {queue.data.sources.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--text)]">{item.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.purpose}</p>
                    <p className="mt-1 text-sm text-[var(--text)]">
                      {item.connection} · {item.freshness}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.note}</p>
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

function IndicatorContext({ indicator }: { indicator: ThreatIndicator }) {
  return (
    <div className="space-y-4 text-sm" data-testid="intel-context">
      <div>
        <p className="text-[var(--muted)]">Identity</p>
        <p className="mt-1 text-[var(--text)]">
          {indicator.indicatorId} · {indicator.intelId} · {indicator.value}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Data handling</p>
        <p className="mt-1 text-[var(--text)]">Reserved example addresses and domains.</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Source and confidence</p>
        <p className="mt-1 text-[var(--text)]">
          {indicator.source} · {indicator.confidence} confidence · {indicator.relevance} relevance
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Validity</p>
        <p className="mt-1 text-[var(--text)]">
          First seen {indicator.firstSeen}. Last seen {indicator.lastSeen}. {indicator.freshness}.{" "}
          {indicator.freshnessDetail}.
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Relationships</p>
        <p className="mt-1 text-[var(--text)]">
          {indicator.relatedCve ?? "No CVE"} · {indicator.relatedAsset ?? "No asset"}
          {indicator.assetSlug ? (
            <>
              {" "}
              ·{" "}
              <Link
                to={`/assets/${indicator.assetSlug}`}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--accent)]"
              >
                Open asset
              </Link>
            </>
          ) : null}
          {" · "}
          {indicator.relatedRecord ?? "No incident or investigation"}
          {indicator.attackMapping ? ` · ${indicator.attackMapping}` : ""}
        </p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Analyst context</p>
        <p className="mt-1 text-[var(--text)]">{indicator.analystContext}</p>
      </div>
      <div>
        <p className="text-[var(--muted)]">Disposition</p>
        <p className="mt-1 text-[var(--text)]">
          {indicator.status}. Validate before blocking or escalation.
        </p>
      </div>
    </div>
  );
}
