import { formatTimestamp } from "@/lib/format";
import type { AssetDetailResponse, AssetListItem, RelatedRecord } from "@/services/api-types";
import type {
  AssetRecord,
  AssetRelationship,
  AssetRelationshipKind,
  AssetSnapshot,
} from "@/types/asset";
import type { OverviewMetric } from "@/types/overview";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryFor(code: string): AssetRecord["category"] {
  if (code === "windows_endpoint") return "endpoint";
  if (code === "linux_server") return "server";
  if (code === "network_device" || code === "security_platform") return "appliance";
  return "server";
}

function relationship(kind: AssetRelationshipKind, record: RelatedRecord): AssetRelationship {
  const status = record.status ?? "Not recorded";
  return {
    id: `${kind}-${record.id}`,
    kind,
    recordId: record.id,
    title: record.title,
    context: record.summary ?? "No additional context is stored.",
    owner: "Not recorded",
    statusLabel: titleCase(status),
    statusTone: status.toLowerCase() === "open" ? "warning" : "neutral",
  };
}

export function mapAssetListItem(item: AssetListItem): AssetRecord {
  const owner = item.owner?.display_name ?? "Unassigned";
  return {
    slug: item.hostname,
    assetId: item.id,
    hostname: item.hostname,
    name: item.name,
    assetType: item.asset_type,
    category: categoryFor(item.asset_type_code),
    platform: item.platform ?? "Not recorded",
    osVersion: "Not recorded",
    owner,
    department: "Not recorded",
    criticality: titleCase(item.criticality),
    environment: titleCase(item.environment),
    exposure: item.exposure === "internet" ? "Internet-exposed" : titleCase(item.exposure),
    telemetryStatus: item.telemetry_status,
    lastSeenLabel: item.last_seen_at ? formatTimestamp(item.last_seen_at) : "Not recorded",
    vulnerabilityCount: 0,
    openIncidentCount: 0,
    serviceSegment: `${titleCase(item.exposure)} · ${item.environment}`,
    ipAddress: "Not recorded",
    dataClassification: "Not recorded",
    lifecycle: titleCase(item.lifecycle),
    softwareSummary: [],
    businessContext: `${titleCase(item.criticality)} business criticality. Distinct from vulnerability severity.`,
    securityContext: `Telemetry ${item.telemetry_status}. Exposure ${item.exposure}.`,
    linkedRecordSummary: "Linked findings are loaded on the asset record, not estimated here.",
    unassignedOwner: item.owner === null,
    relationships: [],
    activity: [],
  };
}

export function mapAssetDetail(item: AssetDetailResponse): AssetRecord {
  const base = mapAssetListItem(item);
  const relationships = [
    ...item.vulnerabilities.map((record) => relationship("vulnerability", record)),
    ...item.alerts.map((record) => relationship("alert", record)),
    ...item.risks.map((record) => relationship("risk", record)),
    ...item.controls.map((record) => relationship("control", record)),
    ...item.evidence.map((record) => relationship("evidence", record)),
  ];
  return {
    ...base,
    osVersion: item.os_version ?? "Not recorded",
    ipAddress: item.ip_address ?? "Not recorded",
    dataClassification: item.data_classification,
    softwareSummary: item.software,
    vulnerabilityCount: item.vulnerabilities.length,
    openIncidentCount: item.alerts.length,
    linkedRecordSummary:
      relationships.length === 0
        ? "No linked vulnerabilities, alerts, risks, controls, or evidence are stored."
        : relationships.map((record) => record.recordId).join(", "),
    relationships,
  };
}

export function inventoryMetrics(items: AssetListItem[]): OverviewMetric[] {
  const critical = items.filter((item) => item.criticality.toLowerCase() === "critical").length;
  const exposed = items.filter((item) => item.exposure.toLowerCase() === "internet").length;
  const missing = items.filter((item) => {
    const status = item.telemetry_status.toLowerCase();
    return status !== "active" && status !== "reporting";
  }).length;
  return [
    {
      id: "in-scope",
      label: "In-scope assets",
      primaryValue: String(items.length),
      secondaryLabel: "Records returned by the API",
      secondaryValue: String(items.length),
      tone: "accent",
      freshness: items.length === 0 ? "empty" : "fresh",
      semantics: "Assets stored for this development organization. Not a security score.",
    },
    {
      id: "critical-assets",
      label: "Critical assets",
      primaryValue: String(critical),
      secondaryLabel: "Business criticality",
      secondaryValue: String(critical),
      tone: "warning",
      freshness: "fresh",
      semantics:
        "Assets whose business criticality is critical. Distinct from vulnerability severity.",
    },
    {
      id: "internet-exposed",
      label: "Internet-exposed assets",
      primaryValue: String(exposed),
      secondaryLabel: "Exposure value internet",
      secondaryValue: String(exposed),
      tone: "warning",
      freshness: "fresh",
      semantics: "Assets marked internet-exposed. Exposure is not an aggregate security score.",
    },
    {
      id: "missing-telemetry",
      label: "Missing telemetry",
      primaryValue: String(missing),
      secondaryLabel: "Not active or reporting",
      secondaryValue: String(missing),
      tone: "critical",
      freshness: missing > 0 ? "empty" : "fresh",
      semantics:
        "Assets whose telemetry_status is not active or reporting. reference_only and not_connected are absences.",
    },
  ];
}

export function mapInventory(
  items: AssetListItem[],
  generatedAt: string,
  environmentLabel: string,
): AssetSnapshot {
  return {
    dataClassification: "SIMULATED",
    generatedAt,
    lastSuccessfulFetchAt: generatedAt,
    environmentLabel,
    snapshotLabel: "DEVELOPMENT / SEEDED",
    metrics: inventoryMetrics(items),
    assets: items.map(mapAssetListItem),
    interpretationNotes: [
      "Counts and rows come from the development database. Demo fixture totals are not mixed in.",
      "Telemetry values such as reference_only and not_connected mean a feed is absent, not healthy.",
      "Open an asset to see only the linked records the API returned.",
    ],
  };
}
