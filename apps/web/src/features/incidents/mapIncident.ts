import { formatTimestamp } from "@/lib/format";
import type { IncidentDetailResponse, IncidentListItem } from "@/services/api-types";
import type {
  IncidentEvidence,
  IncidentIndicator,
  IncidentRecord,
  IncidentSnapshot,
  IncidentTask,
  TimelineEvent,
} from "@/types/incident";
import type { OverviewMetric } from "@/types/overview";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function mapIncidentListItem(item: IncidentListItem): IncidentRecord {
  return {
    id: item.id,
    incidentId: item.id,
    title: item.title,
    severity: titleCase(item.severity),
    status: titleCase(item.status),
    createdLabel: "Not stored",
    owner: item.owner?.display_name ?? "Unassigned",
    affectedService: "Not stored",
    assets: [],
    relatedAlerts: [],
    attackMappings: [],
    containment: item.containment_state ? titleCase(item.containment_state) : "Not stored",
    evidenceCount: item.evidence_count,
    openTaskCount: item.open_task_count,
    lastUpdateLabel: "Not stored",
    summary: item.summary,
    nextAction: "Not stored",
  };
}

export function timelineFrom(detail: IncidentDetailResponse): TimelineEvent[] {
  return detail.timeline.map((event, index) => ({
    id: `${detail.id}-timeline-${index}`,
    incidentId: detail.id,
    whenLabel: formatTimestamp(event.occurred_at),
    title: event.summary,
    detail: event.summary,
  }));
}

export function tasksFrom(detail: IncidentDetailResponse): IncidentTask[] {
  return detail.tasks.map((task, index) => ({
    id: `${detail.id}-task-${index}`,
    taskId: "Not stored",
    incidentId: detail.id,
    title: task.title,
    owner: task.assignee?.display_name ?? "Unassigned",
    dueLabel: "Not stored",
    status: titleCase(task.status),
    priority: "Not stored",
    overdue: false,
  }));
}

export function indicatorsFrom(detail: IncidentDetailResponse): IncidentIndicator[] {
  return detail.indicators.map((indicator, index) => ({
    id: `${detail.id}-indicator-${index}`,
    indicatorId: "Not stored",
    incidentId: detail.id,
    kind: indicator.kind,
    value: indicator.value,
    context: indicator.confidence,
  }));
}

export function evidenceFrom(detail: IncidentDetailResponse): IncidentEvidence[] {
  return detail.evidence.map((item) => ({
    id: item.id,
    evidenceId: item.id,
    incidentId: detail.id,
    type: item.note ?? "Not stored",
    capturedLabel: item.collected_at ? formatTimestamp(item.collected_at) : "Not stored",
    integrityStatus: item.sha256 ? `SHA-256 ${item.sha256}` : "No hash stored",
    linkedControls: item.title,
  }));
}

export function applyIncidentDetail(detail: IncidentDetailResponse): IncidentRecord {
  return {
    ...mapIncidentListItem(detail),
    assets: detail.affected_assets.map((asset) => ({
      hostname: asset.title || asset.id,
      slug: asset.id || null,
    })),
    relatedAlerts: detail.related_alerts.map((alert) => alert.id),
    evidenceCount: detail.evidence.length,
    openTaskCount: detail.tasks.filter(
      (task) => !["closed", "resolved", "done"].includes(task.status.toLowerCase()),
    ).length,
  };
}

export function incidentMetrics(items: IncidentListItem[]): OverviewMetric[] {
  const open = items.filter(
    (item) => !["resolved", "closed"].includes(item.status.toLowerCase()),
  ).length;
  return [
    {
      id: "active",
      label: "Open incidents",
      primaryValue: String(open),
      secondaryLabel: "Stored incident records",
      secondaryValue: String(items.length),
      tone: "warning",
      freshness: items.length === 0 ? "empty" : "fresh",
      semantics:
        "Incidents whose status is not resolved or closed. Severity stays separate. No confirmed compromise is inferred.",
    },
    {
      id: "high",
      label: "High or critical severity",
      primaryValue: String(
        items.filter((item) => ["high", "critical"].includes(item.severity.toLowerCase())).length,
      ),
      secondaryLabel: "Severity label only",
      secondaryValue: "Not a verdict",
      tone: "critical",
      freshness: "fresh",
      semantics:
        "Severity is separate from lifecycle status. No confirmed compromise is inferred from severity.",
    },
    {
      id: "tasks",
      label: "Open tasks",
      primaryValue: String(items.reduce((sum, item) => sum + item.open_task_count, 0)),
      secondaryLabel: "Returned task counts",
      secondaryValue: String(items.reduce((sum, item) => sum + item.open_task_count, 0)),
      tone: "accent",
      freshness: "fresh",
      semantics: "Open task counts returned with the incident list. Due dates are not stored.",
    },
    {
      id: "validation",
      label: "Containment stored",
      primaryValue: String(items.filter((item) => item.containment_state).length),
      secondaryLabel: "Null means not stored",
      secondaryValue: "Not started is not inferred",
      tone: "warning",
      freshness: "empty",
      semantics:
        "containment_state is null in the current API. Filtering it returns an empty page because the column is not stored.",
    },
  ];
}

export function mapIncidentInventory(
  items: IncidentListItem[],
  generatedAt: string,
): IncidentSnapshot {
  return {
    dataClassification: "SIMULATED",
    generatedAt,
    lastSuccessfulFetchAt: generatedAt,
    environmentLabel: "Development · Seeded",
    snapshotLabel: "DEVELOPMENT / SEEDED",
    metrics: incidentMetrics(items),
    incidents: items.map(mapIncidentListItem),
    timeline: [],
    tasks: [],
    indicators: [],
    evidence: [],
    workflowNotes: [
      "NIST SP 800-61 Rev. 3 is the incident-response reference. Lifecycle status and severity stay separate.",
      "No confirmed compromise is inferred from an alert or an open incident.",
      "Containment, related alerts, affected assets, tasks, indicators, and evidence are shown only when the API returns them.",
      "Development seeded data. Wazuh, Suricata, and other telemetry sources are not connected.",
    ],
  };
}
