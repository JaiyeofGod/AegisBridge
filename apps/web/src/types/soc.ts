import type { OverviewMetric } from "@/types/overview";

/** Workflow status for a selected Wazuh alert reference. Not a compromise verdict. */
export type AlertStatus = "New" | "Requires review" | "Investigation opened";

export type AlertSeverity = "Critical" | "High" | "Medium" | "Low";

export type SocSectionId = "alerts" | "investigations" | "detections" | "attack";

export type SocAlert = {
  id: string;
  alertId: string;
  timestampLabel: string;
  detectionId: string;
  detectionName: string;
  severity: AlertSeverity;
  assetHostname: string;
  assetSlug: string | null;
  account: string | null;
  attackTechniqueId: string;
  attackTechniqueName: string;
  attackTactic: string;
  status: AlertStatus;
  investigationId: string | null;
  telemetrySource: string;
  freshness: string;
  assignee: string;
  observedBehavior: string;
  analystContext: string;
  nextAction: string;
};

export type SocInvestigation = {
  id: string;
  investigationId: string;
  title: string;
  alertId: string;
  assetHostname: string;
  status: "Open";
  summary: string;
};

export type SocDetection = {
  id: string;
  detectionId: string;
  name: string;
  sigmaSource: string;
  wazuhStatus: string;
  attackTechniqueId: string;
  attackTechniqueName: string;
  lastValidation: string;
  validationResult: string;
};

export type AttackCoverageRow = {
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  telemetryAvailable: string;
  detectionAvailable: string;
  validationStatus: string;
  detectionId: string;
  lastValidated: string;
};

export type SocSnapshot = {
  dataClassification: "SIMULATED";
  generatedAt: string;
  lastSuccessfulFetchAt: string;
  environmentLabel: string;
  snapshotLabel: string;
  attackVersion: string;
  metrics: OverviewMetric[];
  alerts: SocAlert[];
  investigations: SocInvestigation[];
  detections: SocDetection[];
  attackCoverage: AttackCoverageRow[];
  workflowNotes: string[];
};
