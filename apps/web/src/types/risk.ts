import type { OverviewMetric } from "@/types/overview";

export type RiskSectionId = "register" | "treatments" | "exceptions" | "vendors";

export type TreatmentDecision = string;

export type TreatmentStatus = string;

export type RiskRecord = {
  id: string;
  riskId: string;
  title: string;
  area: string;
  affectedService: string;
  owner: string;
  threat: string;
  scenario: string;
  businessImpact: string;
  linkedRecords: string;
  likelihood: number | null;
  impact: number | null;
  score?: number | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualScore?: number | null;
  riskLevel?: string | null;
  methodologyLabel?: string;
  treatment: string;
  treatmentStatus: string;
  treatmentDetail: string;
  reviewDueLabel: string;
  reviewDueSoon: boolean;
  overdue: boolean;
  acceptedException: boolean;
  vendorName?: string;
  open: boolean;
};

export type RiskSnapshot = {
  dataClassification: "SIMULATED";
  generatedAt: string;
  lastSuccessfulFetchAt: string;
  environmentLabel: string;
  snapshotLabel: string;
  metrics: OverviewMetric[];
  risks: RiskRecord[];
  interpretationNotes: string[];
};
