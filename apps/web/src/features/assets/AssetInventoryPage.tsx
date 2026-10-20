import { useDeferredValue, useMemo, useState } from "react";

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
import {
  AssetInventoryTable,
  type AssetTableFilters,
  type FilterOption,
} from "@/features/assets/AssetInventoryTable";
import { mapInventory } from "@/features/assets/mapAsset";
import { useAssetCatalog, useAssetList } from "@/features/assets/useAssetData";
import { SEEDED_DATA_LABEL, SEEDED_DATA_NOTE } from "@/features/data-origin";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AssetQuery } from "@/services/api-types";
import type { AssetRecord, AssetSectionId } from "@/types/asset";

const sections: { id: AssetSectionId; label: string }[] = [
  { id: "all", label: "All assets" },
  { id: "business-services", label: "Business services" },
  { id: "identities", label: "Identities" },
  { id: "data-quality", label: "Data quality" },
];

const emptyFilters: AssetTableFilters = {
  search: "",
  assetType: "all",
  criticality: "all",
  environment: "all",
  telemetry: "all",
};

const baseEnvironments: FilterOption[] = [
  { value: "production", label: "Production" },
  { value: "lab", label: "Lab" },
  { value: "development", label: "Development" },
];

const baseTelemetry: FilterOption[] = [
  { value: "reporting", label: "Reporting" },
  { value: "missing", label: "Missing" },
  { value: "stale", label: "Stale" },
  { value: "active alerts", label: "Active alerts" },
];

export function AssetInventoryPage() {
  const catalog = useAssetCatalog();
  const [section, setSection] = useState<AssetSectionId>("all");
  const [selectedSlug, setSelectedSlug] = useState("FIN-APP-01");
  const [filters, setFilters] = useState<AssetTableFilters>(emptyFilters);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const query = useMemo(
    () => toAssetQuery({ ...filters, search: deferredSearch }),
    [filters, deferredSearch],
  );
  const hasServerFilters = Object.values(query).length > 0;
  const filtered = useAssetList(query, hasServerFilters);

  const source = hasServerFilters ? (filtered.data ?? catalog.data) : catalog.data;
  const generatedAt = catalog.dataUpdatedAt
    ? new Date(catalog.dataUpdatedAt).toISOString()
    : new Date().toISOString();
  const snapshot = source
    ? mapInventory(
        hasServerFilters ? (filtered.data?.items ?? []) : (catalog.data?.items ?? []),
        generatedAt,
        catalog.data ? "Development · Seeded" : "Development · Seeded",
      )
    : null;
  const catalogSnapshot = catalog.data
    ? mapInventory(catalog.data.items, generatedAt, "Development · Seeded")
    : null;

  const visible = useMemo(() => {
    const assets = snapshot?.assets ?? [];
    if (section === "business-services") {
      return assets.filter(
        (asset) =>
          asset.category === "application" ||
          asset.category === "server" ||
          asset.category === "cloud",
      );
    }
    if (section === "identities") {
      return assets.filter((asset) => asset.category === "identity" || asset.category === "cloud");
    }
    if (section === "data-quality") {
      return assets.filter(
        (asset) => asset.unassignedOwner || !isLiveTelemetry(asset.telemetryStatus),
      );
    }
    return assets;
  }, [snapshot?.assets, section]);

  const selected = visible.find((asset) => asset.slug === selectedSlug) ?? visible[0];
  const typeOptions = uniqueOptions(catalog.data?.items.map((item) => item.asset_type) ?? []);
  const environmentOptions = mergeOptions(
    baseEnvironments,
    catalog.data?.items.map((item) => item.environment) ?? [],
  );
  const telemetryOptions = mergeOptions(
    baseTelemetry,
    catalog.data?.items.map((item) => item.telemetry_status) ?? [],
  );

  return (
    <AppShell environmentLabel="Development · Seeded">
      <PageContainer data-testid="assets-page">
        <PageHeader
          title="Asset inventory"
          description="Know what you protect, who owns it, and where it belongs."
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <Button
                type="button"
                disabled
                title="Asset creation is not connected in this phase"
                aria-label="Add asset (not connected in this phase)"
              >
                Add asset
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

        {catalog.isPending ? <LoadingState label="Updating" rows={4} /> : null}
        {catalog.isError ? (
          <ErrorState
            title="Asset inventory unavailable"
            description="The development asset API did not respond. Retry to load the seeded inventory. Fixture totals are not substituted."
            lastSuccessfulAt={catalog.dataUpdatedAt ? generatedAt : undefined}
            onRetry={() => void catalog.refetch()}
          />
        ) : null}
        {filtered.isError ? (
          <ErrorState
            title="Filtered inventory unavailable"
            description="The asset filter request failed. The unfiltered development counts stay visible. Fixture rows are not added."
            onRetry={() => void filtered.refetch()}
          />
        ) : null}
        {catalog.isSuccess && (catalog.isFetching || filtered.isFetching) ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development inventory"
              lastSuccessfulAt={generatedAt}
            />
          </div>
        ) : null}

        {catalog.isSuccess && catalogSnapshot ? (
          <div className="space-y-8">
            <SectionTabs section={section} onChange={setSection} />
            <section aria-labelledby="asset-summary-heading">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2
                  id="asset-summary-heading"
                  className="font-heading text-xl font-bold text-[var(--text)]"
                >
                  Inventory snapshot
                </h2>
                <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {catalogSnapshot.metrics.map((metric) => (
                  <SummaryMetric key={metric.id} metric={metric} />
                ))}
              </div>
              <p className="mt-4 text-xs text-[var(--muted)]">
                Counts are inventory facts from the development database. There is no aggregate
                security score.
              </p>
            </section>

            <Panel
              title="Asset inventory"
              description="Development records returned by the asset API."
            >
              <AssetInventoryTable
                assets={visible}
                total={
                  hasServerFilters ? (filtered.data?.total ?? visible.length) : catalog.data.total
                }
                selectedSlug={selectedSlug}
                onSelect={setSelectedSlug}
                filters={filters}
                onFiltersChange={setFilters}
                typeOptions={typeOptions}
                environmentOptions={environmentOptions}
                telemetryOptions={telemetryOptions}
              />
            </Panel>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
              <Panel
                title={selected ? `Selected asset · ${selected.hostname}` : "Selected asset"}
                className="h-full"
              >
                {selected ? (
                  <SelectedAsset asset={selected} />
                ) : (
                  <p className="text-sm text-[var(--muted)]">No asset is selected.</p>
                )}
              </Panel>
              <Panel title="Workflow & interpretation" className="h-full">
                <ul className="space-y-3">
                  {catalogSnapshot.interpretationNotes.map((note) => (
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
          </div>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function SectionTabs({
  section,
  onChange,
}: {
  section: AssetSectionId;
  onChange: (section: AssetSectionId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Asset inventory sections"
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
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectedAsset({ asset }: { asset: AssetRecord }) {
  return (
    <dl className="space-y-4 text-sm">
      <div>
        <dt className="text-[var(--muted)]">Business criticality</dt>
        <dd className="mt-1 text-[var(--text)]">{asset.businessContext}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Network context</dt>
        <dd className="mt-1 text-[var(--text)]">{asset.serviceSegment}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Security context</dt>
        <dd className="mt-1 text-[var(--text)]">
          {asset.securityContext} · Telemetry {asset.telemetryStatus} · Last seen{" "}
          {asset.lastSeenLabel}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Linked records</dt>
        <dd className="mt-1 text-[var(--text)]">{asset.linkedRecordSummary}</dd>
      </div>
    </dl>
  );
}

function toAssetQuery(filters: AssetTableFilters): AssetQuery {
  return {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.assetType !== "all" ? { assetType: filters.assetType } : {}),
    ...(filters.criticality !== "all" ? { criticality: filters.criticality } : {}),
    ...(filters.environment !== "all" ? { environment: filters.environment } : {}),
    ...(filters.telemetry !== "all" ? { telemetryStatus: filters.telemetry } : {}),
  };
}

function isLiveTelemetry(status: string) {
  const normalized = status.toLowerCase();
  return normalized === "active" || normalized === "reporting";
}

function uniqueOptions(values: string[]): FilterOption[] {
  return Array.from(new Set(values.filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
}

function mergeOptions(base: FilterOption[], extra: string[]): FilterOption[] {
  const seen = new Set(base.map((option) => option.value.toLowerCase()));
  const additions: FilterOption[] = [];
  for (const value of extra) {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    additions.push({ value, label: value.replaceAll("_", " ") });
  }
  return [...base, ...additions];
}
