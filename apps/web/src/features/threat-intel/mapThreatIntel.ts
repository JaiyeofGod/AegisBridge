import { formatTimestamp } from "@/lib/format";
import type {
  AdvisoryListItem,
  IndicatorDetailResponse,
  IndicatorListItem,
  ThreatIntelSummary,
  ThreatSourceItem,
} from "@/services/api-types";
import type { OverviewMetric } from "@/types/overview";

export type IndicatorView = {
  id: string;
  indicatorType: string;
  indicatorTypeLabel: string;
  value: string;
  confidence: string | null;
  confidenceLabel: string;
  severity: string | null;
  sourceId: string;
  sourceName: string;
  sourceStatus: string;
  sourceConnectionLabel: string;
  firstSeen: string;
  lastSeen: string;
  status: string;
  internalMatch: boolean;
  attackTechniqueId: string | null;
  matchedAssetId: string | null;
};

export type IndicatorDetailView = IndicatorView & {
  summary: string;
  attackName: string | null;
  attackTactic: string | null;
  matchedAssetTitle: string | null;
  matchedAssetSummary: string | null;
  dataOrigin: string;
  dataOriginLabel: string;
  indicatorSubtype: string | null;
  indicatorSubtypeLabel: string | null;
  threatType: string | null;
  malwareFamily: string | null;
  tags: string[];
  feedStatus: string | null;
  sourceConfidence: number | null;
  referenceUrl: string | null;
  fetchedAt: string | null;
};

export type AdvisoryView = {
  id: string;
  title: string;
  summary: string;
  status: string;
  confidence: string;
  relatedCve: string;
  publishedAt: string;
  sourceId: string;
  sourceName: string;
  sourceStatus: string;
};

export type ThreatSourceView = {
  id: string;
  name: string;
  provider: string;
  purpose: string;
  connectionStatus: string;
  connectionLabel: string;
  notes: string;
};

export type ThreatIntelMetrics = {
  metrics: OverviewMetric[];
  notes: string[];
};

const connectionLabels: Record<string, string> = {
  configured: "Configured",
  reference_only: "Reference only",
  not_connected: "Not connected",
  delayed: "Delayed",
  healthy: "Healthy",
};

export function connectionLabel(status: string) {
  return connectionLabels[status] ?? status;
}

const subtypeLabels: Record<string, string> = {
  ipv4: "IPv4",
  ipv6: "IPv6",
  domain: "Domain",
  hostname: "Hostname",
  url: "URL",
  md5: "MD5",
  sha1: "SHA-1",
  sha256: "SHA-256",
};

export function indicatorTypeLabel(type: string) {
  if (type === "ip") return "IP";
  if (type === "url") return "URL";
  if (type === "file_hash") return "File hash";
  if (type === "domain") return "Domain";
  return type;
}

export function indicatorSubtypeLabel(subtype: string | null | undefined) {
  if (!subtype) return null;
  return subtypeLabels[subtype] ?? subtype;
}

export function dataOriginLabel(origin: string | null | undefined) {
  if (origin === "external_feed") return "External feed";
  if (origin === "simulated") return "Simulated";
  if (!origin) return "Not assigned";
  return origin;
}

export function aegisConfidenceLabel(confidence: string | null | undefined) {
  if (!confidence) return "Not assigned";
  return titleCase(confidence);
}

/** http(s) only. Does not request the URL. */
export function safeReferenceUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function mapThreatIntelSummary(summary: ThreatIntelSummary): ThreatIntelMetrics {
  const healthEntries = Object.entries(summary.source_health);
  const sourceTotal = healthEntries.reduce((sum, [, count]) => sum + count, 0);
  return {
    metrics: [
      metric(
        "active-indicators",
        "Active indicators",
        String(summary.active_indicator_count),
        "Stored status active",
        "Active count uses stored indicator status. It is not a live feed count.",
      ),
      metric(
        "internal-matches",
        "Internal matches",
        String(summary.internal_match_count),
        "Stored match labels",
        "An internal match is a stored simulated label, not a confirmed compromise.",
      ),
      metric(
        "advisories",
        "Advisories",
        String(summary.advisory_count),
        "Stored metadata",
        "Advisory count is the number of advisory rows stored in the development database.",
      ),
      healthEntries.length === 0
        ? {
            id: "source-health",
            label: "Source health",
            primaryValue: "None stored",
            secondaryLabel: "Connection status",
            secondaryValue: "No source records",
            tone: "neutral",
            freshness: "empty",
            semantics: "No threat-intelligence source rows are stored.",
          }
        : metric(
            "source-health",
            "Source health",
            String(sourceTotal),
            healthEntries.map(([status, count]) => `${count} ${status}`).join(" · "),
            "Source health counts stored connection_status values. reference_only and not_connected mean the named feed is not connected.",
          ),
    ],
    notes: originNotes(summary),
  };
}

function originNotes(summary: ThreatIntelSummary) {
  const score = "There is no aggregate threat or security score.";
  if (summary.data_origin === "mixed") {
    return [
      summary.semantics,
      "Records mix external feeds and simulated rows. A listed indicator is not a compromise or a block.",
      score,
    ];
  }
  if (summary.data_origin === "external_feed") {
    return [
      summary.semantics,
      "These indicator records come from external feeds. A listed indicator is not a compromise or a block.",
      score,
    ];
  }
  return [
    summary.semantics,
    "Development seeded data. This is not live threat intelligence. CISA KEV, NVD, EPSS, ThreatFox, and URLhaus are catalog names unless a source row says otherwise.",
    "Reserved TEST-NET addresses, example domains, and synthetic hashes stay simulated.",
    score,
  ];
}

export function mapIndicator(item: IndicatorListItem): IndicatorView {
  return {
    id: item.id,
    indicatorType: item.indicator_type,
    indicatorTypeLabel: indicatorTypeLabel(item.indicator_type),
    value: item.value,
    confidence: item.confidence,
    confidenceLabel: aegisConfidenceLabel(item.confidence),
    severity: item.severity ? titleCase(item.severity) : null,
    sourceId: item.source.id,
    sourceName: item.source.name,
    sourceStatus: item.source.connection_status,
    sourceConnectionLabel: connectionLabel(item.source.connection_status),
    firstSeen: formatTimestamp(item.first_seen),
    lastSeen: formatTimestamp(item.last_seen),
    status: item.status,
    internalMatch: item.internal_match,
    attackTechniqueId: item.attack_technique_id,
    matchedAssetId: item.matched_asset_id,
  };
}

export function mapIndicatorDetail(item: IndicatorDetailResponse): IndicatorDetailView {
  const tags = (item.tags ?? []).filter((tag): tag is string => typeof tag === "string");
  return {
    ...mapIndicator(item),
    summary: item.summary,
    attackName: item.attack?.name ?? null,
    attackTactic: item.attack?.tactic ?? null,
    matchedAssetTitle: item.matched_asset?.title ?? null,
    matchedAssetSummary: item.matched_asset?.summary ?? null,
    dataOrigin: item.data_origin,
    dataOriginLabel: dataOriginLabel(item.data_origin),
    indicatorSubtype: item.indicator_subtype ?? null,
    indicatorSubtypeLabel: indicatorSubtypeLabel(item.indicator_subtype),
    threatType: item.threat_type ?? null,
    malwareFamily: item.malware_family ?? null,
    tags,
    feedStatus: item.source_status ?? null,
    sourceConfidence: typeof item.source_confidence === "number" ? item.source_confidence : null,
    referenceUrl: safeReferenceUrl(item.reference_url),
    fetchedAt: item.fetched_at ? formatTimestamp(item.fetched_at) : null,
  };
}

export function mapAdvisory(item: AdvisoryListItem): AdvisoryView {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    status: item.status,
    confidence: item.confidence ? titleCase(item.confidence) : "Not stored",
    relatedCve: item.related_cve ?? "No CVE stored",
    publishedAt: item.published_at ? formatTimestamp(item.published_at) : "Not stored",
    sourceId: item.source.id,
    sourceName: item.source.name,
    sourceStatus: item.source.connection_status,
  };
}

export function mapThreatSource(item: ThreatSourceItem): ThreatSourceView {
  return {
    id: item.id,
    name: item.name,
    provider: item.provider,
    purpose: item.purpose,
    connectionStatus: item.connection_status,
    connectionLabel: connectionLabel(item.connection_status),
    notes: item.notes ?? "No source note is stored.",
  };
}

function metric(
  id: string,
  label: string,
  primaryValue: string,
  secondaryValue: string,
  semantics: string,
): OverviewMetric {
  return {
    id,
    label,
    primaryValue,
    secondaryLabel: "",
    secondaryValue,
    tone: "neutral",
    freshness: "fresh",
    semantics,
  };
}
