import { useMemo, useState } from "react";

import { Button } from "@/components/buttons/Button";
import { Panel } from "@/components/cards/Panel";
import { SummaryMetric } from "@/components/cards/SummaryMetric";
import { SimulatedDataBanner } from "@/components/feedback/SimulatedDataBanner";
import { AppShell } from "@/components/navigation/AppShell";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";
import { StatusBadge } from "@/components/status/StatusBadge";
import { AssetInventoryTable } from "@/features/assets/AssetInventoryTable";
import { useAssetData } from "@/features/assets/useAssetData";
import { cn } from "@/lib/cn";
import type { AssetRecord, AssetSectionId } from "@/types/asset";

const sections: { id: AssetSectionId; label: string }[] = [
  { id: "all", label: "All assets" },
  { id: "business-services", label: "Business services" },
  { id: "identities", label: "Identities" },
  { id: "data-quality", label: "Data quality" },
];

export function AssetInventoryPage() {
  const inventory = useAssetData();
  const [section, setSection] = useState<AssetSectionId>("all");
  const [selectedSlug, setSelectedSlug] = useState("FIN-APP-01");

  const visible = useMemo(() => {
    const assets = inventory.data.assets;
    if (section === "business-services") {
      return assets.filter(
        (asset) =>
          asset.category === "application" ||
          asset.category === "server" ||
          asset.category === "cloud",
      );
    }
    if (section === "identities")
      return assets.filter((asset) => asset.category === "identity" || asset.category === "cloud");
    if (section === "data-quality")
      return assets.filter(
        (asset) =>
          asset.unassignedOwner ||
          asset.telemetryStatus === "Missing" ||
          asset.telemetryStatus === "Stale",
      );
    return assets;
  }, [inventory.data.assets, section]);

  const selected = inventory.data.assets.find((asset) => asset.slug === selectedSlug) ?? visible[0];

  return (
    <AppShell environmentLabel={inventory.data.environmentLabel}>
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
              <SimulatedDataBanner message={inventory.data.snapshotLabel} />
            </div>
          }
        />

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
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-8">
          <section aria-labelledby="asset-summary-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2
                id="asset-summary-heading"
                className="font-heading text-xl font-bold text-[var(--text)]"
              >
                Inventory snapshot
              </h2>
              <StatusBadge label="SIMULATED" tone="warning" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {inventory.data.metrics.map((metric) => (
                <SummaryMetric key={metric.id} metric={metric} />
              ))}
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">
              Counts are inventory facts. There is no aggregate security score.
            </p>
          </section>

          <Panel
            title="Asset inventory"
            description="Sample records from the simulated AegisBridge Technologies inventory."
          >
            <AssetInventoryTable
              assets={visible}
              selectedSlug={selectedSlug}
              onSelect={setSelectedSlug}
            />
          </Panel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
            <Panel
              title={selected ? `Selected asset · ${selected.hostname}` : "Selected asset"}
              className="h-full"
            >
              {selected ? <SelectedAsset asset={selected} /> : null}
            </Panel>
            <Panel title="Workflow & interpretation" className="h-full">
              <ul className="space-y-3">
                {inventory.data.interpretationNotes.map((note) => (
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
      </PageContainer>
    </AppShell>
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
