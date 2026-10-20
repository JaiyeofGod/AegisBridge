import type { OverviewMetric } from "@/types/overview";

export type AssetCriticality = "Low" | "Medium" | "High" | "Critical";

export type AssetEnvironment = "Production" | "Lab" | "Development";

export type TelemetryStatus = "Reporting" | "Missing" | "Stale" | "Active alerts";

export type AssetSectionId = "all" | "business-services" | "identities" | "data-quality";

export type AssetDetailSectionId =
  "summary" | "vulnerabilities" | "alerts" | "risks-controls" | "evidence" | "activity";

export type AssetRelationshipKind = "vulnerability" | "alert" | "risk" | "control" | "evidence";

export type AssetRelationship = {
  id: string;
  kind: AssetRelationshipKind;
  recordId: string;
  title: string;
  context: string;
  owner: string;
  statusLabel: string;
  statusTone: "critical" | "warning" | "success" | "neutral" | "accent";
};

export type AssetRecord = {
  slug: string;
  assetId: string;
  hostname: string;
  name: string;
  assetType: string;
  category: "endpoint" | "server" | "appliance" | "application" | "cloud" | "identity";
  platform: string;
  osVersion: string;
  owner: string;
  department: string;
  criticality: AssetCriticality;
  environment: AssetEnvironment;
  exposure: "Internet-exposed" | "Internal";
  telemetryStatus: TelemetryStatus;
  lastSeenLabel: string;
  vulnerabilityCount: number;
  openIncidentCount: number;
  serviceSegment: string;
  ipAddress: string;
  dataClassification: string;
  lifecycle: "Active" | "Maintenance" | "Planned";
  softwareSummary: string[];
  businessContext: string;
  securityContext: string;
  linkedRecordSummary: string;
  unassignedOwner: boolean;
  relationships: AssetRelationship[];
  activity: { id: string; label: string; when: string }[];
};

export type AssetSnapshot = {
  dataClassification: "SIMULATED";
  generatedAt: string;
  lastSuccessfulFetchAt: string;
  environmentLabel: string;
  snapshotLabel: string;
  metrics: OverviewMetric[];
  assets: AssetRecord[];
  interpretationNotes: string[];
};
