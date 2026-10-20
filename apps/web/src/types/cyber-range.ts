import type { OverviewMetric } from "@/types/overview";

export type ZoneId = "MGMT" | "CORP" | "SERVER" | "DMZ" | "ATTACK";

export type RangeSectionId = "topology" | "segments" | "scenarios" | "runs";

export type RelationshipKind = "Telemetry" | "Logging" | "Policy" | "Hypothetical";

export type LabSystem = {
  id: string;
  hostname: string;
  zone: ZoneId;
  address: string;
  role: string;
  telemetry: string;
  state: "Reporting" | "Stopped";
  freshness: string;
  summary: string;
};

export type LabSegment = {
  id: ZoneId;
  cidr: string;
  purpose: string;
  gateway: string;
  systems: string[];
  isolation: string;
};

export type LabRelationship = {
  id: string;
  from: string;
  to: string;
  kind: RelationshipKind;
  detail: string;
};

export type LabScenario = {
  id: string;
  scenarioId: string;
  title: string;
  category: string;
  targets: string;
  expectedTelemetry: string;
  detections: string;
  status: "Planned" | "Ready" | "Simulated" | "Validated";
  lastRun: string;
  validationResult: "Validated" | "Partial" | "Failed" | "Not run" | "Not connected";
};

export type LabRun = {
  id: string;
  runId: string;
  scenarioId: string;
  started: string;
  duration: string;
  result: "Validated" | "Partial" | "Failed";
  detections: string;
  telemetrySources: string;
  notes: string;
};

export type CyberRangeSnapshot = {
  dataClassification: "SIMULATED";
  generatedAt: string;
  lastSuccessfulFetchAt: string;
  environmentLabel: string;
  snapshotLabel: string;
  metrics: OverviewMetric[];
  systems: LabSystem[];
  segments: LabSegment[];
  relationships: LabRelationship[];
  scenarios: LabScenario[];
  runs: LabRun[];
  workflowNotes: string[];
};
