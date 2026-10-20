import type { OverviewMetric } from "@/types/overview";

/** Lifecycle state. Kept separate from severity. Inspired by NIST SP 800-61 Rev. 3 operations, not a NIST formula. */
export type IncidentStatus =
  "New" | "Investigating" | "Containment" | "Eradication" | "Recovery" | "Resolved" | "Closed";

export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical";

export type ContainmentState =
  "Not started" | "Awaiting decision" | "In progress" | "Contained" | "Not required";

export type IncidentSectionId = "incidents" | "timeline" | "tasks" | "indicators" | "evidence";

export type TaskStatus = "Open" | "In progress" | "Done";
export type TaskPriority = "Low" | "Medium" | "High";

export type IncidentRecord = {
  id: string;
  incidentId: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  createdLabel: string;
  owner: string;
  affectedService: string;
  assets: { hostname: string; slug: string | null }[];
  relatedAlerts: string[];
  attackMappings: string[];
  containment: ContainmentState;
  evidenceCount: number;
  openTaskCount: number;
  lastUpdateLabel: string;
  summary: string;
  nextAction: string;
};

export type TimelineEvent = {
  id: string;
  incidentId: string;
  whenLabel: string;
  title: string;
  detail: string;
};

export type IncidentTask = {
  id: string;
  taskId: string;
  incidentId: string;
  title: string;
  owner: string;
  dueLabel: string;
  status: TaskStatus;
  priority: TaskPriority;
  overdue: boolean;
};

export type IncidentIndicator = {
  id: string;
  indicatorId: string;
  incidentId: string;
  kind: "IP" | "Domain" | "File hash" | "Account" | "Process";
  value: string;
  context: string;
};

export type IncidentEvidence = {
  id: string;
  evidenceId: string;
  incidentId: string;
  type: string;
  capturedLabel: string;
  integrityStatus: string;
  linkedControls: string;
};

export type IncidentSnapshot = {
  dataClassification: "SIMULATED";
  generatedAt: string;
  lastSuccessfulFetchAt: string;
  environmentLabel: string;
  snapshotLabel: string;
  metrics: OverviewMetric[];
  incidents: IncidentRecord[];
  timeline: TimelineEvent[];
  tasks: IncidentTask[];
  indicators: IncidentIndicator[];
  evidence: IncidentEvidence[];
  workflowNotes: string[];
};
