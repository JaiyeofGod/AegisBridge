import type { OverviewMetric } from "@/types/overview";
import type { Impact, Likelihood } from "@/features/risk/risk-model";

export type RiskSectionId = "register" | "treatments" | "exceptions" | "vendors";

export type TreatmentDecision = "Mitigate" | "Accept" | "Transfer" | "Avoid";

export type TreatmentStatus = "In progress" | "Overdue" | "Planned" | "Complete" | "Accepted";

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
  likelihood: Likelihood;
  impact: Impact;
  residualLikelihood: Likelihood;
  residualImpact: Impact;
  treatment: TreatmentDecision;
  treatmentStatus: TreatmentStatus;
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
