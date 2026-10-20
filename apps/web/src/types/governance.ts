import type { MetricFreshness, OverviewMetric } from "@/types/overview";

export type GovernanceSectionId =
  "summary" | "frameworks" | "controls" | "evidence" | "policies" | "access-reviews";

export type ControlImplementationStatus =
  "Implemented" | "Partially Implemented" | "Planned" | "Not Implemented" | "Not Applicable";

export type GovernanceStatusTone = "critical" | "warning" | "success" | "neutral" | "accent";

export type FrameworkCoverage = {
  id: string;
  name: string;
  version: string;
  role: string;
  currentProfileLabel: string;
  targetProfileLabel: string;
  coveredCount: number;
  totalInScope: number;
  notes: string;
};

export type ControlRecord = {
  id: string;
  controlId: string;
  framework: string;
  title: string;
  owner: string;
  status: ControlImplementationStatus;
  statusTone: GovernanceStatusTone;
  evidenceCount: number;
  testFrequency: string;
  implementationSummary: string;
};

export type EvidenceRecord = {
  id: string;
  evidenceId: string;
  title: string;
  linkedControlId: string;
  freshnessLabel: string;
  freshness: MetricFreshness;
  dueLabel: string;
  statusTone: GovernanceStatusTone;
};

export type AssessmentRecord = {
  id: string;
  name: string;
  frameworkScope: string;
  owner: string;
  statusLabel: string;
  statusTone: GovernanceStatusTone;
};

export type PolicyRecord = {
  id: string;
  name: string;
  version: string;
  owner: string;
  reviewState: string;
  reviewTone: GovernanceStatusTone;
  nextReviewLabel: string;
};

export type AccessReviewRecord = {
  id: string;
  name: string;
  scope: string;
  owner: string;
  decisionsCompleted: number;
  decisionsTotal: number;
  statusLabel: string;
  statusTone: GovernanceStatusTone;
  findingSummary: string;
};

export type GovernanceSnapshot = {
  dataClassification: "SIMULATED";
  generatedAt: string;
  lastSuccessfulFetchAt: string;
  environmentLabel: string;
  snapshotLabel: string;
  metrics: OverviewMetric[];
  assessments: AssessmentRecord[];
  evidenceDue: EvidenceRecord[];
  frameworks: FrameworkCoverage[];
  controls: ControlRecord[];
  evidence: EvidenceRecord[];
  policies: PolicyRecord[];
  accessReviews: AccessReviewRecord[];
  interpretationNotes: string[];
};
