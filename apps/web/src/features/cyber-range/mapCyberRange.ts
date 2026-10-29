import { formatTimestamp } from "@/lib/format";
import type {
  CyberRangeSummary,
  LabDetectionItem,
  LabScenarioDetail,
  LabScenarioListItem,
  LabSystemDetail,
  LabSystemListItem,
  LabSystemRelationshipItem,
  LabTelemetryItem,
  LabZoneItem,
} from "@/services/api-types";
import { catalogRelationshipKinds, type CatalogRelationshipKind } from "@/types/cyber-range";
import type { OverviewMetric } from "@/types/overview";

export type LabZoneView = {
  id: string;
  name: string;
  cidr: string;
  gateway: string;
  purpose: string;
  status: string;
  statusLabel: string;
  observedState: string;
  observedLabel: string;
  isolationNotes: string;
  systemCount: number;
  systemIds: string[];
  notes: string;
};

export type LabSystemView = {
  id: string;
  hostname: string;
  zoneId: string;
  zoneName: string;
  ipAddress: string;
  role: string;
  platform: string;
  expectedState: string;
  expectedLabel: string;
  observedState: string;
  observedLabel: string;
  telemetryStatus: string;
  telemetryLabel: string;
  lastSeenAt: string;
  sourceOrigin: string;
  notes: string;
  telemetrySource: string;
  telemetryExpected: boolean | null;
  telemetryFreshness: string;
  telemetrySemantics: string;
};

export type LabScenarioView = {
  id: string;
  name: string;
  objective: string;
  status: string;
  statusLabel: string;
  category: string;
  attackTechniques: string;
  expectedSystems: string;
  expectedDetections: string;
  lastRunAt: string;
  safetyNotes: string;
  expectedTelemetry: string;
  notes: string;
};

export type LabTelemetryView = {
  systemId: string;
  hostname: string;
  telemetrySource: string;
  expected: string;
  status: string;
  statusLabel: string;
  lastSeenAt: string;
  freshness: string;
  semantics: string;
};

export type LabDetectionView = {
  id: string;
  name: string;
  description: string;
  status: string;
  dataSource: string;
  sigmaReference: string;
  wazuhStatus: string;
  validationState: string;
  validationLabel: string;
  lastValidatedAt: string;
  attackTechniques: string;
  notes: string;
};

const statusLabels: Record<string, string> = {
  defined: "Defined",
  planned: "Planned",
  ready: "Ready",
  simulated: "Simulated",
  validated: "Validated",
  retired: "Retired",
  draft: "Draft",
  approved: "Approved",
  not_observed: "Not observed",
  not_connected: "Not connected",
  not_reporting: "Not reporting",
  not_validated: "Not validated",
  reference_only: "Reference only",
  development_seed: "Development seed",
};

function labelStored(value: string | null | undefined, fallback = "Not recorded") {
  if (value == null || value.trim().length === 0) return fallback;
  return statusLabels[value] ?? value;
}

function optionalText(value: string | null | undefined, fallback = "Not recorded") {
  if (value == null || value.trim().length === 0) return fallback;
  return value;
}

function optionalTimestamp(value: string | null | undefined, fallback = "Not recorded") {
  if (value == null) return fallback;
  return formatTimestamp(value);
}

export function mapCyberRangeSummary(summary: CyberRangeSummary): {
  metrics: OverviewMetric[];
  notes: string[];
} {
  return {
    metrics: [
      {
        id: "expected-systems",
        label: "Expected systems",
        primaryValue: String(summary.expected_system_count),
        secondaryLabel: "Zones in catalog",
        secondaryValue: String(summary.zone_count),
        tone: "accent",
        freshness: "fresh",
        semantics:
          "Approved lab systems in the development catalog. Separate from enterprise assets.",
      },
      {
        id: "active-observed",
        label: "Active observed",
        primaryValue: String(summary.active_observed_system_count),
        secondaryLabel: "Freshness",
        secondaryValue: labelStored(summary.freshness_state),
        tone: summary.active_observed_system_count === 0 ? "warning" : "accent",
        freshness: summary.active_observed_system_count === 0 ? "empty" : "fresh",
        semantics:
          "Observed counts stay at zero when systems are not_observed. Expected is not active.",
      },
      {
        id: "telemetry",
        label: "Telemetry coverage",
        primaryValue: `${summary.telemetry_active_count} / ${summary.telemetry_expected_count}`,
        secondaryLabel: "Lab Bridge",
        secondaryValue: labelStored(summary.lab_bridge_status),
        tone: "warning",
        freshness: "stale",
        semantics: "Wazuh and Suricata stay not_connected unless a stored row says otherwise.",
      },
      {
        id: "scenarios",
        label: "Scenarios ready",
        primaryValue: `${summary.scenarios_ready_count} / ${summary.scenarios_total_count}`,
        secondaryLabel: "Running now",
        secondaryValue: String(summary.scenarios_running_count),
        tone: "neutral",
        freshness: "fresh",
        semantics:
          "Ready/validated catalog rows only. Running stays zero because no runner exists.",
      },
    ],
    notes: [
      summary.semantics,
      summary.data_origin,
      "Topology is development catalog metadata. Systems are expected and not currently observed.",
      "Telemetry is not connected. Scenario last_run_at stays empty when no run is stored.",
      "Detection validation has not been performed. Lab Bridge is not connected.",
      "MacBook is the development machine. Lenovo is the private cyber-range host.",
      "No public inbound management path exists. Future Lab Bridge is outbound-only.",
      "No SSH, shell, VM, firewall, or scenario-execution controls are available.",
    ],
  };
}

export function mapLabZone(item: LabZoneItem, systemIds: string[] = []): LabZoneView {
  return {
    id: item.id,
    name: item.name,
    cidr: item.cidr,
    gateway: optionalText(item.gateway, "No gateway stored"),
    purpose: item.purpose,
    status: item.status,
    statusLabel: labelStored(item.status),
    observedState: item.observed_state,
    observedLabel: labelStored(item.observed_state),
    isolationNotes: optionalText(item.isolation_notes, "No isolation notes stored"),
    systemCount: item.system_count,
    systemIds,
    notes: optionalText(item.notes, "No notes stored"),
  };
}

export function mapLabSystem(item: LabSystemListItem | LabSystemDetail): LabSystemView {
  const detail = "telemetry_source" in item ? item : null;
  return {
    id: item.id,
    hostname: item.hostname,
    zoneId: item.zone.id,
    zoneName: item.zone.title,
    ipAddress: optionalText(item.ip_address),
    role: item.role,
    platform: optionalText(item.platform),
    expectedState: item.expected_state,
    expectedLabel: labelStored(item.expected_state),
    observedState: item.observed_state,
    observedLabel: labelStored(item.observed_state),
    telemetryStatus: item.telemetry_status,
    telemetryLabel: labelStored(item.telemetry_status),
    lastSeenAt: optionalTimestamp(item.last_seen_at),
    sourceOrigin: labelStored(item.source_origin, item.source_origin),
    notes: optionalText(item.notes, "No notes stored"),
    telemetrySource: optionalText(detail?.telemetry_source, "Not recorded"),
    telemetryExpected: detail?.telemetry_expected ?? null,
    telemetryFreshness: optionalText(detail?.telemetry_freshness, "Not recorded"),
    telemetrySemantics: optionalText(detail?.telemetry_semantics, "Not recorded"),
  };
}

export function mapLabScenario(item: LabScenarioListItem | LabScenarioDetail): LabScenarioView {
  const detail = "expected_telemetry" in item ? item : null;
  return {
    id: item.id,
    name: item.name,
    objective: item.objective,
    status: item.status,
    statusLabel: labelStored(item.status),
    category: item.category,
    attackTechniques:
      item.attack_techniques.length > 0
        ? item.attack_techniques.map((technique) => technique.id).join(" · ")
        : "None stored",
    expectedSystems:
      item.expected_system_ids.length > 0 ? item.expected_system_ids.join(", ") : "None",
    expectedDetections:
      item.expected_detection_ids.length > 0 ? item.expected_detection_ids.join(" · ") : "None",
    lastRunAt: optionalTimestamp(item.last_run_at, "Not run"),
    safetyNotes: optionalText(item.safety_notes, "No safety notes stored"),
    expectedTelemetry: optionalText(detail?.expected_telemetry, "Not recorded"),
    notes: optionalText(detail?.notes, "No notes stored"),
  };
}

export function mapLabTelemetry(item: LabTelemetryItem): LabTelemetryView {
  return {
    systemId: item.system_id,
    hostname: item.hostname,
    telemetrySource: optionalText(item.telemetry_source),
    expected: item.expected ? "Expected" : "Not expected",
    status: item.status,
    statusLabel: labelStored(item.status),
    lastSeenAt: optionalTimestamp(item.last_seen_at),
    freshness: optionalText(item.freshness),
    semantics: optionalText(item.semantics),
  };
}

export function mapLabDetection(item: LabDetectionItem): LabDetectionView {
  return {
    id: item.id,
    name: item.name,
    description: optionalText(item.description),
    status: item.status,
    dataSource: optionalText(item.data_source),
    sigmaReference: optionalText(item.sigma_reference),
    wazuhStatus: optionalText(item.wazuh_mapping_status),
    validationState: item.validation_state ?? "not_validated",
    validationLabel: labelStored(item.validation_state, "Not validated"),
    lastValidatedAt: optionalTimestamp(item.last_validated_at),
    attackTechniques:
      item.attack_techniques.length > 0
        ? item.attack_techniques
            .map((technique) => `${technique.id} · ${technique.name}`)
            .join("; ")
        : "None stored",
    notes: optionalText(item.notes),
  };
}

export type LabSystemRelationshipView = {
  id: string;
  sourceSystemId: string;
  targetSystemId: string;
  kind: CatalogRelationshipKind;
};

export type CatalogRelationState = "selected" | "related" | "unrelated" | "unknown";

export type CatalogRelationshipStatement = {
  id: string;
  otherSystemId: string;
  text: string;
};

const outgoingLabel: Record<CatalogRelationshipKind, string> = {
  connected_to: "Connected to",
  depends_on: "Depends on",
  manages: "Manages",
  monitors: "Monitors",
};

const incomingLabel: Record<CatalogRelationshipKind, string> = {
  connected_to: "Connected from",
  depends_on: "Dependency of",
  manages: "Managed by",
  monitors: "Monitored by",
};

function isCatalogRelationshipKind(value: string): value is CatalogRelationshipKind {
  return (catalogRelationshipKinds as readonly string[]).includes(value);
}

export function mapLabSystemRelationship(
  item: LabSystemRelationshipItem,
): LabSystemRelationshipView | null {
  if (!isCatalogRelationshipKind(item.relationship_kind)) return null;
  if (item.source_system_id === item.target_system_id) return null;
  return {
    id: item.id,
    sourceSystemId: item.source_system_id,
    targetSystemId: item.target_system_id,
    kind: item.relationship_kind,
  };
}

/** Systems named by a stored edge that touches the selection. Not transitive. */
export function directCatalogPeerIds(
  selectedId: string,
  relationships: LabSystemRelationshipView[],
): Set<string> {
  const peers = new Set<string>();
  if (!selectedId) return peers;
  for (const item of relationships) {
    if (item.sourceSystemId === selectedId) peers.add(item.targetSystemId);
    else if (item.targetSystemId === selectedId) peers.add(item.sourceSystemId);
  }
  peers.delete(selectedId);
  return peers;
}

export function catalogRelationState(
  systemId: string,
  selectedId: string,
  peers: ReadonlySet<string>,
  relationshipsKnown: boolean,
): CatalogRelationState {
  if (selectedId && systemId === selectedId) return "selected";
  if (!relationshipsKnown || !selectedId) return "unknown";
  return peers.has(systemId) ? "related" : "unrelated";
}

export function catalogRelationshipStatements(
  selectedId: string,
  relationships: LabSystemRelationshipView[],
  hostnameById: ReadonlyMap<string, string>,
): CatalogRelationshipStatement[] {
  if (!selectedId) return [];
  const statements: CatalogRelationshipStatement[] = [];
  for (const item of relationships) {
    if (item.sourceSystemId === selectedId) {
      const name = hostnameById.get(item.targetSystemId) ?? item.targetSystemId;
      statements.push({
        id: item.id,
        otherSystemId: item.targetSystemId,
        text: `${outgoingLabel[item.kind]} → ${name}`,
      });
    } else if (item.targetSystemId === selectedId) {
      const name = hostnameById.get(item.sourceSystemId) ?? item.sourceSystemId;
      statements.push({
        id: item.id,
        otherSystemId: item.sourceSystemId,
        text: `${incomingLabel[item.kind]} ← ${name}`,
      });
    }
  }
  return statements;
}

export function observedTone(observedState: string): "success" | "warning" | "neutral" {
  if (observedState === "not_observed") return "warning";
  if (observedState.includes("reporting")) return "success";
  return "neutral";
}
