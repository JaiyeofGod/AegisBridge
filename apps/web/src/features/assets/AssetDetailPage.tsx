import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

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
import { isNotFound, useAssetDetail } from "@/features/assets/useAssetData";
import { SEEDED_DATA_LABEL, SEEDED_DATA_NOTE } from "@/features/data-origin";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AssetDetailSectionId, AssetRecord, AssetRelationship } from "@/types/asset";
import type { OverviewMetric } from "@/types/overview";

const sections: { id: AssetDetailSectionId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "vulnerabilities", label: "Vulnerabilities" },
  { id: "alerts", label: "Alerts" },
  { id: "risks-controls", label: "Risks & controls" },
  { id: "evidence", label: "Evidence" },
  { id: "activity", label: "Activity" },
];

export function AssetDetailPage() {
  const { assetId = "" } = useParams();
  const detail = useAssetDetail(assetId);
  const [section, setSection] = useState<AssetDetailSectionId>("summary");
  const asset = detail.data;
  const lastSuccessfulAt = detail.dataUpdatedAt
    ? new Date(detail.dataUpdatedAt).toISOString()
    : undefined;

  if (detail.isPending) {
    return (
      <AppShell environmentLabel="Development · Seeded">
        <PageContainer data-testid="asset-detail-page">
          <LoadingState label="Updating" rows={4} />
        </PageContainer>
      </AppShell>
    );
  }

  if (detail.isError && isNotFound(detail.error)) {
    return (
      <AppShell environmentLabel="Development · Seeded">
        <PageContainer data-testid="asset-detail-page">
          <PageHeader
            title="Asset not found"
            description="The development inventory has no record for that id."
          />
          <Link
            to="/assets"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)]"
          >
            Back to asset inventory
          </Link>
        </PageContainer>
      </AppShell>
    );
  }

  if (detail.isError || !asset) {
    return (
      <AppShell environmentLabel="Development · Seeded">
        <PageContainer data-testid="asset-detail-page">
          <ErrorState
            title="Asset record unavailable"
            description="The development asset API did not respond. Fixture records are not substituted."
            lastSuccessfulAt={lastSuccessfulAt}
            onRetry={() => void detail.refetch()}
          />
        </PageContainer>
      </AppShell>
    );
  }

  const metrics = detailMetrics(asset);
  const visible = relationshipsFor(asset, section);

  return (
    <AppShell environmentLabel="Development · Seeded">
      <PageContainer data-testid="asset-detail-page">
        <p className="mb-3">
          <Link
            to="/assets"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)]"
          >
            Back to asset inventory
          </Link>
        </p>
        <PageHeader
          title={asset.hostname}
          description={`${asset.assetType} · ${asset.name} · ${asset.owner} owner · ${asset.criticality} asset · ${asset.assetId}`}
          actions={
            <div className="flex flex-col items-end gap-2.5">
              <Button
                type="button"
                disabled
                aria-label="Edit asset (not connected in this phase)"
                title="Editing is not connected in this phase"
              >
                Edit asset
              </Button>
              <SimulatedDataBanner message={SEEDED_DATA_NOTE} />
              {lastSuccessfulAt ? (
                <p className="text-xs text-[var(--muted)]" data-testid="last-successful-fetch">
                  Last successful update: {formatTimestamp(lastSuccessfulAt)}
                </p>
              ) : null}
            </div>
          }
        />

        <div
          role="tablist"
          aria-label="Asset detail sections"
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

        {detail.isFetching ? (
          <div className="mb-6">
            <StaleDataIndicator
              message="Refreshing development asset"
              lastSuccessfulAt={lastSuccessfulAt}
            />
          </div>
        ) : null}

        <div className="space-y-8">
          {section === "summary" ? (
            <div className="mb-4 flex justify-end">
              <StatusBadge label={SEEDED_DATA_LABEL} tone="warning" />
            </div>
          ) : null}
          {section === "summary" ? (
            <section aria-labelledby="asset-detail-metrics">
              <h2 id="asset-detail-metrics" className="sr-only">
                Connected record counts
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <SummaryMetric key={metric.id} metric={metric} />
                ))}
              </div>
              <p className="mt-4 text-xs text-[var(--muted)]">
                There is no aggregate security score for this asset.
              </p>
            </section>
          ) : null}

          {section === "activity" ? (
            <Panel title="Activity" description="Stored events for this asset.">
              <ul className="space-y-3" data-testid="asset-activity">
                {asset.activity.length === 0 ? (
                  <li className="text-sm text-[var(--muted)]">
                    No activity records are stored for this asset.
                  </li>
                ) : (
                  asset.activity.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-[var(--radius-control)] bg-[var(--raised)] px-3 py-3"
                    >
                      <p className="font-medium text-[var(--text)]">{event.label}</p>
                      <p className="text-xs text-[var(--muted)]">{event.when}</p>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
          ) : (
            <Panel
              title="Connected security records"
              description="Contextual links only. Full modules are not opened from this view."
            >
              <RelationshipTable records={visible} />
            </Panel>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
            <Panel title={`Selected asset · ${asset.hostname}`} className="h-full">
              <AssetProfile asset={asset} />
            </Panel>
            <Panel title="Evidence & validation" className="h-full">
              <EvidenceSummary asset={asset} />
            </Panel>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}

function detailMetrics(asset: AssetRecord): OverviewMetric[] {
  const vulns = asset.relationships.filter((item) => item.kind === "vulnerability");
  const alerts = asset.relationships.filter((item) => item.kind === "alert");
  const controls = asset.relationships.filter((item) => item.kind === "control");
  const evidence = asset.relationships.filter((item) => item.kind === "evidence");
  return [
    {
      id: "open-findings",
      label: "Open findings",
      primaryValue: String(vulns.length),
      secondaryLabel: "KEV label",
      secondaryValue: "Not labeled on the finding record",
      tone: "critical",
      freshness: "fresh",
      semantics: "Open vulnerability findings on this asset. Not a security score.",
    },
    {
      id: "related-alerts",
      label: "Related alerts",
      primaryValue: String(alerts.length),
      secondaryLabel: "Stored alert references",
      secondaryValue: String(alerts.length),
      tone: "warning",
      freshness: "fresh",
      semantics:
        "Alert references stored for this asset. An empty count is an absence, not a healthy zero from a live feed.",
    },
    {
      id: "linked-controls",
      label: "Linked controls",
      primaryValue: String(controls.length),
      secondaryLabel: "mapped",
      secondaryValue: controls.map((item) => item.recordId).join(" and ") || "None",
      tone: "accent",
      freshness: "fresh",
      semantics: "Controls mapped to this asset. Coverage is not certification.",
    },
    {
      id: "evidence-items",
      label: "Evidence items",
      primaryValue: String(evidence.length),
      secondaryLabel: "Overdue requests",
      secondaryValue: String(evidence.filter((item) => item.statusLabel === "Overdue").length),
      tone: "warning",
      freshness: "fresh",
      semantics: "Evidence packages linked to this asset.",
    },
  ];
}

function relationshipsFor(asset: AssetRecord, section: AssetDetailSectionId): AssetRelationship[] {
  if (section === "vulnerabilities")
    return asset.relationships.filter((item) => item.kind === "vulnerability");
  if (section === "alerts") return asset.relationships.filter((item) => item.kind === "alert");
  if (section === "risks-controls")
    return asset.relationships.filter((item) => item.kind === "risk" || item.kind === "control");
  if (section === "evidence") return asset.relationships.filter((item) => item.kind === "evidence");
  const previewOrder: AssetRelationship["kind"][] = ["vulnerability", "alert", "risk", "control"];
  return previewOrder
    .map((kind) => asset.relationships.find((item) => item.kind === kind))
    .filter((item): item is AssetRelationship => Boolean(item));
}

function RelationshipTable({ records }: { records: AssetRelationship[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) =>
      `${record.recordId} ${record.title} ${record.context} ${record.owner}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query, records]);

  return (
    <div className="space-y-4">
      <div>
        <label
          className="mb-2 block text-sm font-medium text-[var(--text)]"
          htmlFor="asset-record-search"
        >
          Search records
        </label>
        <input
          id="asset-record-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search records…"
          className="min-h-11 w-full max-w-md rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]"
        />
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)]">
        <table className="min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Connected vulnerabilities, alerts, risks, controls, and evidence
          </caption>
          <thead className="bg-[var(--raised)] text-[var(--muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Record
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Context
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Owner
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-[var(--muted)]">
                  No connected records are stored for this view.
                </td>
              </tr>
            ) : (
              filtered.map((record) => (
                <tr
                  key={record.id}
                  className="border-t border-[var(--border)]"
                  data-kind={record.kind}
                >
                  <td className="px-4 py-3 font-medium text-[var(--text)]">
                    {record.recordId} · {record.title}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{record.context}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{record.owner}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={record.statusLabel} tone={record.statusTone} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Showing {filtered.length} of {records.length} stored records
      </p>
    </div>
  );
}

function AssetProfile({ asset }: { asset: AssetRecord }) {
  return (
    <dl className="space-y-4 text-sm" data-testid="asset-profile">
      <div>
        <dt className="text-[var(--muted)]">Identity and ownership</dt>
        <dd className="mt-1 text-[var(--text)]">
          {asset.assetId} · {asset.hostname} · Owner {asset.owner} · {asset.department}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Technical profile</dt>
        <dd className="mt-1 text-[var(--text)]">
          {asset.platform} · {asset.osVersion} · {asset.ipAddress} · {asset.lifecycle}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Business criticality</dt>
        <dd className="mt-1 text-[var(--text)]">{asset.businessContext}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Exposure</dt>
        <dd className="mt-1 text-[var(--text)]">
          {asset.exposure} · {asset.environment} · {asset.serviceSegment}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Telemetry freshness</dt>
        <dd className="mt-1 text-[var(--text)]">
          {asset.telemetryStatus} · Last seen {asset.lastSeenLabel}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Software and services</dt>
        <dd className="mt-1 text-[var(--text)]">
          {asset.softwareSummary.join(" · ") || "None recorded"}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Security context</dt>
        <dd className="mt-1 text-[var(--text)]">{asset.securityContext}</dd>
      </div>
      <div>
        <dt className="text-[var(--muted)]">Linked records</dt>
        <dd className="mt-1 text-[var(--text)]">{asset.linkedRecordSummary}</dd>
      </div>
    </dl>
  );
}

function EvidenceSummary({ asset }: { asset: AssetRecord }) {
  const evidence = asset.relationships.filter((item) => item.kind === "evidence");
  if (evidence.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]" data-testid="asset-evidence">
        No evidence records are stored for this asset.
      </p>
    );
  }
  return (
    <div data-testid="asset-evidence">
      <ul className="space-y-2 text-sm text-[var(--text)]">
        {evidence.map((item) => (
          <li key={item.id}>
            {item.recordId} · {item.title} — {item.statusLabel.toLowerCase()}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
        Retain source, timestamp, reviewer, and version. Evidence status is a collection fact, not a
        security score.
      </p>
    </div>
  );
}
