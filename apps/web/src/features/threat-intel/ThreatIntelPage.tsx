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
import { useAuthStatus } from "@/features/auth/useAuthSession";
import { SEEDED_DATA_LABEL, SEEDED_DATA_NOTE } from "@/features/data-origin";
import { AttackExplorer } from "@/features/threat-intel/AttackExplorer";
import {
  mapAdvisory,
  mapIndicator,
  mapIndicatorDetail,
  mapThreatIntelSummary,
  mapThreatSource,
  type IndicatorDetailView,
  type IndicatorView,
} from "@/features/threat-intel/mapThreatIntel";
import {
  IndicatorValue,
  ThreatIndicatorTable,
  type IndicatorTableFilters,
} from "@/features/threat-intel/ThreatIndicatorTable";
import {
  INDICATOR_PAGE_SIZE,
  useAdvisories,
  useIndicatorDetail,
  useIndicatorList,
  useThreatIntelSummary,
  useThreatSources,
} from "@/features/threat-intel/useThreatIntelData";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { IndicatorQuery } from "@/services/api-types";
import type { IntelSectionId } from "@/types/threat-intel";

const baseSections: { id: IntelSectionId; label: string }[] = [
  { id: "indicators", label: "Indicators" },
  { id: "advisories", label: "Advisories" },
  { id: "enrichment", label: "Enrichment" },
  { id: "sources", label: "Sources" },
];

const emptyFilters: IndicatorTableFilters = {
  search: "",
  indicatorType: "all",
  source: "all",
  status: "all",
  internalMatch: "all",
};

export function ThreatIntelPage() {
  const auth = useAuthStatus();
  const canReadAttack = auth.user?.permissions.includes("threat_intel.read") === true;
  const sections = canReadAttack
    ? [...baseSections, { id: "attack" as const, label: "MITRE ATT&CK" }]
    : baseSections;
  const summary = useThreatIntelSummary();
  const advisories = useAdvisories();
  const sources = useThreatSources();
  const [section, setSection] = useState<IntelSectionId>("indicators");
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<IndicatorTableFilters>(emptyFilters);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const filterQuery = useMemo(
    () => toIndicatorQuery({ ...filters, search: deferredSearch }),
    [filters, deferredSearch],
  );
  const hasFilters = Object.keys(filterQuery).length > 0;
  const query = useMemo(
    () => ({ ...filterQuery, page, pageSize: INDICATOR_PAGE_SIZE }),
    [filterQuery, page],
  );
  const indicators = useIndicatorList(query);
  const generatedAt = summary.dataUpdatedAt
    ? new Date(summary.dataUpdatedAt).toISOString()
    : new Date().toISOString();
  const listed = (indicators.data?.items ?? []).map(mapIndicator);
  const selectedRow = listed.find((item) => item.id === selectedId) ?? listed[0];
  const detail = useIndicatorDetail(selectedRow?.id ?? "");
  const selected =
    detail.data && detail.data.id === selectedRow?.id
      ? mapIndicatorDetail(detail.data)
      : selectedRow;
  const metrics = summary.data ? mapThreatIntelSummary(summary.data) : null;
  const advisoryItems = advisories.data?.items.map(mapAdvisory) ?? [];
  const sourceViews = sources.data?.items.map(mapThreatSource) ?? [];
  const refreshing =
    summary.isFetching ||
    indicators.isFetching ||
    detail.isFetching ||
    advisories.isFetching ||
    sources.isFetching;
  const originNote =
    section === "indicators" ? indicatorOriginNote(summary.data?.data_origin) : SEEDED_DATA_NOTE;

  return (
    <AppShell environmentLabel="Development · Seeded">
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
              {section === "attack" ? null : <SimulatedDataBanner message={originNote} />}
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

        {section === "attack" && canReadAttack ? <AttackExplorer /> : null}

        {section !== "attack" && summary.isPending ? (
          <LoadingState label="Updating" rows={4} />
        ) : null}
        {section !== "attack" && summary.isError ? (
          <ErrorState
            title="Threat intelligence data unavailable"
            description="The development threat-intelligence API did not respond. Retry to load the seeded summary. Fixture rows are not substituted."
            lastSuccessfulAt={summary.dataUpdatedAt ? generatedAt : undefined}
            onRetry={() => void summary.refetch()}
          />
        ) : null}
        {section !== "attack" && indicators.isError ? (
          <ErrorState
            title="Indicator list unavailable"
            description="The indicator request failed. Fixture indicators are not substituted."
            onRetry={() => void indicators.refetch()}
          />
        ) : null}
        {section !== "attack" && detail.isError ? (
          <ErrorState
            title="Indicator record unavailable"
            description="The indicator detail request failed. Related records are not invented."
            onRetry={() => void detail.refetch()}
          />
        ) : null}
        {section !== "attack" && summary.isSuccess && refreshing ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development threat intelligence"
              lastSuccessfulAt={generatedAt}
            />
          </div>
        ) : null}

        {section !== "attack" && summary.isSuccess && metrics ? (
          <div className="space-y-8">
            {section === "indicators" && indicators.isPending ? (
              <LoadingState label="Updating" rows={3} />
            ) : null}
            {section === "indicators" && indicators.isSuccess ? (
              <>
                <section aria-labelledby="intel-summary-heading">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2
                      id="intel-summary-heading"
                      className="font-heading text-xl font-bold text-[var(--text)]"
                    >
                      Intelligence snapshot
                    </h2>
                    <StatusBadge
                      label={snapshotOriginLabel(summary.data.data_origin)}
                      tone={summary.data.data_origin === "simulated" ? "warning" : "neutral"}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {metrics.metrics.map((metric) => (
                      <SummaryMetric key={metric.id} metric={metric} />
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-[var(--muted)]">
                    Confidence and status stay separate. There is no aggregate threat or security
                    score.
                  </p>
                </section>

                <Panel
                  title="Indicator workspace"
                  description="Stored indicators. Open a row for source context. A listed value is not a compromise or a block."
                >
                  <ThreatIndicatorTable
                    indicators={listed}
                    total={indicators.data?.total ?? listed.length}
                    page={indicators.data?.page ?? page}
                    pageSize={indicators.data?.page_size ?? INDICATOR_PAGE_SIZE}
                    onPageChange={setPage}
                    selectedId={selected?.id ?? ""}
                    onSelect={setSelectedId}
                    filters={filters}
                    onFiltersChange={(next) => {
                      setFilters(next);
                      setPage(1);
                    }}
                    sourceOptions={sourceViews.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                    emptyLabel={
                      hasFilters && indicators.isPending
                        ? "Updating indicator filters."
                        : hasFilters
                          ? "No indicators match these filters."
                          : "No indicators are stored."
                    }
                  />
                </Panel>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
                  <Panel title="Indicator context" className="h-full">
                    {selected ? (
                      <IndicatorContext indicator={selected} />
                    ) : (
                      <p className="text-sm text-[var(--muted)]">No indicator is selected.</p>
                    )}
                  </Panel>
                  <Panel title="Workflow & interpretation" className="h-full">
                    <ul className="space-y-3">
                      {metrics.notes.map((note) => (
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
                description="Stored advisory metadata. External advisory feeds are not queried."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                {advisories.isPending ? <LoadingState label="Updating" rows={2} /> : null}
                {advisories.isError ? (
                  <ErrorState
                    title="Advisories unavailable"
                    description="The advisory request failed. Fixture advisories are not substituted."
                    onRetry={() => void advisories.refetch()}
                  />
                ) : null}
                {advisories.isSuccess && advisoryItems.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No advisories are stored.</p>
                ) : null}
                {advisories.isSuccess && advisoryItems.length > 0 ? (
                  <ul className="space-y-3" data-testid="intel-advisories">
                    {advisoryItems.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                      >
                        <p className="font-medium text-[var(--text)]">
                          {item.id} · {item.title}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {item.sourceName} · {item.sourceId} · {item.sourceStatus} ·{" "}
                          {item.confidence} confidence · {item.status}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text)]">{item.summary}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {item.relatedCve} · Published {item.publishedAt}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            ) : null}

            {section === "enrichment" ? (
              <Panel
                title="Enrichment history"
                description="Enrichment links are not stored on this screen."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                <p className="text-sm text-[var(--muted)]" data-testid="intel-enrichment">
                  No enrichment history is stored. Internal matches and ATT&CK mappings stay on the
                  indicator records.
                </p>
              </Panel>
            ) : null}

            {section === "sources" ? (
              <Panel
                title="Sources"
                description="Stored source catalog. Healthy means the most recent feed read succeeded."
                action={<StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />}
              >
                {sources.isPending ? <LoadingState label="Updating" rows={2} /> : null}
                {sources.isError ? (
                  <ErrorState
                    title="Threat sources unavailable"
                    description="The source request failed. Fixture sources are not substituted."
                    onRetry={() => void sources.refetch()}
                  />
                ) : null}
                {sources.isSuccess && sourceViews.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]" data-testid="intel-sources">
                    No source health records are stored.
                  </p>
                ) : null}
                {sources.isSuccess && sourceViews.length > 0 ? (
                  <ul className="space-y-3" data-testid="intel-sources">
                    {sourceViews.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3"
                      >
                        <p className="font-medium text-[var(--text)]">
                          {item.id} · {item.name}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {item.provider} · {item.purpose}
                        </p>
                        <p className="mt-1 text-sm text-[var(--text)]">
                          {item.connectionLabel} · {item.connectionStatus}
                        </p>
                        {item.connectionStatus === "healthy" ? (
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            Healthy means the most recent feed read succeeded. It is not guaranteed
                            uptime, real-time streaming, or proof that each indicator is correct.
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm text-[var(--muted)]">{item.notes}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            ) : null}
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function IndicatorContext({ indicator }: { indicator: IndicatorView | IndicatorDetailView }) {
  const detail = "summary" in indicator ? indicator : null;
  return (
    <div className="space-y-5 text-sm" data-testid="intel-context">
      <section aria-labelledby="indicator-identity-heading" className="space-y-2">
        <h3 id="indicator-identity-heading" className="font-semibold text-[var(--text)]">
          Indicator
        </h3>
        <dl className="space-y-2">
          <DetailRow label="Public id" value={indicator.id} />
          <div>
            <dt className="text-[var(--muted)]">Value</dt>
            <dd className="mt-1">
              <IndicatorValue value={indicator.value} />
            </dd>
          </div>
          <DetailRow label="Type" value={indicator.indicatorTypeLabel} />
          {detail?.indicatorSubtypeLabel ? (
            <DetailRow label="Subtype" value={detail.indicatorSubtypeLabel} />
          ) : null}
          <DetailRow label="Status" value={indicator.status} />
          <div>
            <dt className="text-[var(--muted)]">Data origin</dt>
            <dd className="mt-1">
              <StatusBadge
                label={detail?.dataOriginLabel ?? "Detail loading"}
                tone={detail?.dataOrigin === "external_feed" ? "accent" : "neutral"}
              />
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="indicator-source-heading" className="space-y-2">
        <h3 id="indicator-source-heading" className="font-semibold text-[var(--text)]">
          Source context
        </h3>
        <dl className="space-y-2">
          <DetailRow label="Source" value={`${indicator.sourceName} · ${indicator.sourceId}`} />
          <DetailRow
            label="Source connection"
            value={`${indicator.sourceConnectionLabel} · ${indicator.sourceStatus}`}
          />
          {detail?.threatType ? <DetailRow label="Threat type" value={detail.threatType} /> : null}
          {detail?.malwareFamily ? (
            <DetailRow label="Malware family" value={detail.malwareFamily} />
          ) : null}
          {detail?.feedStatus ? (
            <DetailRow label="Source status" value={detail.feedStatus} />
          ) : null}
          {detail && detail.sourceConfidence !== null ? (
            <DetailRow label="Source confidence" value={String(detail.sourceConfidence)} />
          ) : null}
          {detail ? (
            <div>
              <dt className="text-[var(--muted)]">Tags</dt>
              <dd className="mt-1">
                <TagList tags={detail.tags} />
              </dd>
            </div>
          ) : null}
          {detail?.referenceUrl ? (
            <div>
              <dt className="text-[var(--muted)]">Source reference</dt>
              <dd className="mt-1">
                <a
                  href={detail.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center font-semibold break-all text-[var(--accent)]"
                >
                  Source reference
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
        {detail?.feedStatus ? (
          <p className="text-xs text-[var(--muted)]">
            Source status is the feed&apos;s own label. Online or offline is not a compromise
            finding and does not mean an AegisBridge asset contacted this indicator.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="indicator-timing-heading" className="space-y-2">
        <h3 id="indicator-timing-heading" className="font-semibold text-[var(--text)]">
          Timing
        </h3>
        <dl className="space-y-2">
          <DetailRow label="First seen" value={indicator.firstSeen} />
          <DetailRow label="Last seen" value={indicator.lastSeen} />
          {detail?.fetchedAt ? (
            <DetailRow label="Fetched by AegisBridge" value={detail.fetchedAt} />
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="indicator-aegis-heading" className="space-y-2">
        <h3 id="indicator-aegis-heading" className="font-semibold text-[var(--text)]">
          AegisBridge context
        </h3>
        <dl className="space-y-2">
          <DetailRow label="AegisBridge confidence" value={indicator.confidenceLabel} />
          <DetailRow label="Severity" value={indicator.severity ?? "Not stored"} />
          <DetailRow
            label="Internal match"
            value={
              indicator.internalMatch
                ? "Stored internal match. Not a live correlation and not a confirmed compromise."
                : "No internal match is stored."
            }
          />
          <DetailRow
            label="Summary"
            value={detail?.summary ?? "Indicator detail is still loading."}
          />
        </dl>
        <p className="text-[var(--text)]">
          {indicator.matchedAssetId ?? "No asset"}
          {detail?.matchedAssetTitle ? ` · ${detail.matchedAssetTitle}` : ""}
          {indicator.matchedAssetId ? (
            <>
              {" "}
              ·{" "}
              <Link
                to={`/assets/${indicator.matchedAssetId}`}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--accent)]"
              >
                Open asset
              </Link>
            </>
          ) : null}
          {" · "}
          {indicator.attackTechniqueId
            ? `${indicator.attackTechniqueId}${detail?.attackName ? ` · ${detail.attackName}` : ""}${detail?.attackTactic ? ` · ${detail.attackTactic}` : ""}`
            : "No ATT&CK mapping stored"}
        </p>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 break-words text-[var(--text)]">{value}</dd>
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (tags.length === 0) {
    return <p className="text-[var(--muted)]">No tags stored.</p>;
  }
  const visible = expanded ? tags : tags.slice(0, 8);
  const hidden = tags.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex max-w-full items-center rounded-full bg-[var(--raised)] px-2.5 py-1 text-xs break-all text-[var(--text)]"
        >
          {tag}
        </span>
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          className="inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-semibold text-[var(--accent)]"
          onClick={() => setExpanded(true)}
        >
          +{hidden} more
        </button>
      ) : null}
    </div>
  );
}

function indicatorOriginNote(origin: string | undefined) {
  if (origin === "mixed") {
    return "Indicator records include external feeds and simulated rows. A feed listing is not a compromise or a block.";
  }
  if (origin === "external_feed") {
    return "Indicator records on this page come from external feeds. A feed listing is not a compromise or a block.";
  }
  return SEEDED_DATA_NOTE;
}

function snapshotOriginLabel(origin: string) {
  if (origin === "mixed") return "MIXED ORIGIN";
  if (origin === "external_feed") return "EXTERNAL FEED";
  if (origin === "simulated") return SEEDED_DATA_LABEL;
  return origin;
}

function toIndicatorQuery(filters: IndicatorTableFilters): IndicatorQuery {
  const query: IndicatorQuery = {};
  if (filters.search) query.search = filters.search;
  if (filters.indicatorType !== "all") query.indicatorType = filters.indicatorType;
  if (filters.source !== "all") query.source = filters.source;
  if (filters.status !== "all") query.status = filters.status;
  if (filters.internalMatch === "true") query.internalMatch = true;
  if (filters.internalMatch === "false") query.internalMatch = false;
  return query;
}
