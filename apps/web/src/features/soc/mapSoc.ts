import { formatTimestamp } from "@/lib/format";
import type { AlertDetailResponse, AlertListItem } from "@/services/api-types";
import type { OverviewMetric } from "@/types/overview";
import type {
  AttackCoverageRow,
  SocAlert,
  SocDetection,
  SocInvestigation,
  SocSnapshot,
} from "@/types/soc";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function mapAlertListItem(item: AlertListItem): SocAlert {
  return {
    id: item.id,
    alertId: item.id,
    timestampLabel: formatTimestamp(item.observed_at),
    detectionId: item.detection_id ?? "Not recorded",
    detectionName: item.detection_name ?? "Not recorded",
    severity: titleCase(item.severity),
    assetHostname: item.asset_hostname ?? "Not recorded",
    assetSlug: item.asset_id,
    account: null,
    attackTechniqueId: item.attack_technique_id ?? "Not recorded",
    attackTechniqueName: item.attack_technique_name ?? "Not recorded",
    attackTactic: item.attack_tactic ?? "Not recorded",
    status: titleCase(item.status),
    investigationId: item.investigation_id,
    telemetrySource: `${item.source_of_record} · ${item.stored_scope} · telemetry ${item.telemetry_source}`,
    freshness: item.stored_scope,
    assignee: item.assignee?.display_name ?? "Unassigned",
    observedBehavior: item.summary,
    analystContext: item.investigation_id
      ? "Investigation summary loads with the alert record."
      : "No investigation is stored.",
    nextAction: "Raw Wazuh events are not stored. This row is selected metadata only.",
  };
}

export function applyAlertDetail(detail: AlertDetailResponse): SocAlert {
  const base = mapAlertListItem(detail);
  return {
    ...base,
    analystContext:
      detail.investigation_summary ??
      (detail.investigation_id
        ? "No investigation summary is stored."
        : "No investigation is stored."),
    nextAction: detail.detection_logic_summary
      ? `${detail.detection_logic_summary} Raw events are not stored.`
      : base.nextAction,
  };
}

export function investigationsFrom(
  items: AlertListItem[],
  detail: AlertDetailResponse | undefined,
): SocInvestigation[] {
  return items
    .filter((item) => item.investigation_id)
    .map((item) => {
      const matched = detail?.id === item.id ? detail : undefined;
      return {
        id: item.investigation_id ?? item.id,
        investigationId: item.investigation_id ?? "Not recorded",
        title: "Investigation title is not returned by the alert API.",
        alertId: item.id,
        assetHostname: item.asset_hostname ?? "Not recorded",
        status: matched?.investigation_status
          ? titleCase(matched.investigation_status)
          : "Not recorded",
        summary:
          matched?.investigation_summary ??
          "Investigation summary loads with the selected alert record.",
      };
    });
}

export function detectionsFrom(
  items: AlertListItem[],
  detail: AlertDetailResponse | undefined,
): SocDetection[] {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    if (!item.detection_id || seen.has(item.detection_id)) return [];
    seen.add(item.detection_id);
    const matched = detail?.detection_id === item.detection_id ? detail : undefined;
    return [
      {
        id: item.detection_id,
        detectionId: item.detection_id,
        name: item.detection_name ?? "Not recorded",
        sigmaSource: "Not stored",
        wazuhStatus: matched?.detection_status ?? "Not recorded",
        attackTechniqueId: item.attack_technique_id ?? "Not recorded",
        attackTechniqueName: item.attack_technique_name ?? "Not recorded",
        lastValidation: "Not stored",
        validationResult: matched?.detection_logic_summary ?? "Not stored",
      },
    ];
  });
}

export function attackCoverageFrom(
  items: AlertListItem[],
  detail: AlertDetailResponse | undefined,
): AttackCoverageRow[] {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    if (!item.attack_technique_id || seen.has(item.attack_technique_id)) return [];
    seen.add(item.attack_technique_id);
    const matched = detail?.attack_technique_id === item.attack_technique_id ? detail : undefined;
    return [
      {
        techniqueId: item.attack_technique_id,
        techniqueName: item.attack_technique_name ?? "Not recorded",
        tactic: item.attack_tactic ?? "Not recorded",
        telemetryAvailable: item.telemetry_source,
        detectionAvailable: item.detection_id ?? "Not recorded",
        validationStatus: "Not stored",
        detectionId: item.detection_id ?? "Not recorded",
        lastValidated: matched?.attack_version ?? "Not stored",
      },
    ];
  });
}

export function socMetrics(items: AlertListItem[]): OverviewMetric[] {
  const investigations = items.filter((item) => item.investigation_id).length;
  const disconnected = items.filter((item) => item.telemetry_source !== "active").length;
  return [
    {
      id: "alerts",
      label: "Selected alerts",
      primaryValue: String(items.length),
      secondaryLabel: "Stored alert references",
      secondaryValue: String(items.length),
      tone: "accent",
      freshness: items.length === 0 ? "empty" : "fresh",
      semantics:
        "Selected alert metadata. Wazuh remains the system of record. Raw events are not stored.",
    },
    {
      id: "investigations",
      label: "Linked investigations",
      primaryValue: String(investigations),
      secondaryLabel: "Investigation ids on the alert",
      secondaryValue: String(investigations),
      tone: "warning",
      freshness: "fresh",
      semantics: "No confirmed compromise is inferred from an investigation link.",
    },
    {
      id: "telemetry",
      label: "Telemetry connected",
      primaryValue: String(items.length - disconnected),
      secondaryLabel: "Feeds not connected",
      secondaryValue: String(disconnected),
      tone: "warning",
      freshness: disconnected > 0 ? "empty" : "fresh",
      semantics:
        "not_connected telemetry is an absence. These rows do not mean Wazuh or Suricata are connected.",
    },
    {
      id: "techniques",
      label: "ATT&CK techniques",
      primaryValue: String(
        new Set(items.map((item) => item.attack_technique_id).filter(Boolean)).size,
      ),
      secondaryLabel: "Returned mappings",
      secondaryValue: "Not coverage",
      tone: "accent",
      freshness: "fresh",
      semantics:
        "Technique ids returned with these alerts. This is not organizational ATT&CK coverage.",
    },
  ];
}

export function mapSocInventory(
  items: AlertListItem[],
  generatedAt: string,
  detail?: AlertDetailResponse,
): SocSnapshot {
  return {
    dataClassification: "SIMULATED",
    generatedAt,
    lastSuccessfulFetchAt: generatedAt,
    environmentLabel: "Development · Seeded",
    snapshotLabel: "DEVELOPMENT / SEEDED",
    attackVersion: detail?.attack_version ?? "ATT&CK version loads with the selected alert",
    metrics: socMetrics(items),
    alerts: items.map((item) =>
      detail?.id === item.id ? applyAlertDetail(detail) : mapAlertListItem(item),
    ),
    investigations: investigationsFrom(items, detail),
    detections: detectionsFrom(items, detail),
    attackCoverage: attackCoverageFrom(items, detail),
    workflowNotes: [
      "Wazuh remains the SIEM of record. These rows are selected alert metadata, not a raw event index.",
      "No confirmed compromise is inferred from an alert.",
      "ATT&CK mappings are shown only when the API returns them. They are not organizational coverage.",
      "Development seeded data. Wazuh, Suricata, and other telemetry sources are not connected.",
    ],
  };
}
