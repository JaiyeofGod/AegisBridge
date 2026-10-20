import type { RiskDetailResponse, RiskListItem } from "@/services/api-types";
import type { OverviewMetric } from "@/types/overview";
import type { RiskRecord, RiskSnapshot } from "@/types/risk";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function closed(status: string) {
  const normalized = status.toLowerCase();
  return normalized === "closed" || normalized === "resolved";
}

export function mapRiskListItem(item: RiskListItem): RiskRecord {
  const strategy = item.treatment_strategy?.toLowerCase() ?? "";
  const accepted = strategy === "accept";
  return {
    id: item.id,
    riskId: item.id,
    title: item.title,
    area: "Not recorded",
    affectedService: item.asset_hostname ?? "Not recorded",
    owner: item.owner?.display_name ?? "Unassigned",
    threat: "Not recorded",
    scenario: item.title,
    businessImpact: "Not recorded",
    linkedRecords: item.asset_hostname
      ? `${item.asset_hostname} · ${item.asset_id}`
      : "No asset is stored.",
    likelihood: item.likelihood,
    impact: item.impact,
    score: item.score,
    residualLikelihood: item.residual_likelihood,
    residualImpact: item.residual_impact,
    residualScore: item.residual_score,
    riskLevel: item.risk_level,
    methodologyLabel: item.methodology_label,
    treatment: item.treatment_strategy ? titleCase(item.treatment_strategy) : "Not recorded",
    treatmentStatus: item.treatment_status ? titleCase(item.treatment_status) : "Not recorded",
    treatmentDetail: "Treatment notes load on the risk record.",
    reviewDueLabel: "Not stored",
    reviewDueSoon: false,
    overdue: false,
    acceptedException: accepted,
    open: !closed(item.status) && !accepted,
  };
}

export function applyRiskDetail(detail: RiskDetailResponse): RiskRecord {
  const evidence =
    detail.evidence.length === 0
      ? "No evidence is stored."
      : detail.evidence.map((item) => item.id).join(", ");
  const reviews =
    detail.reviews.length === 0
      ? "No reviews are stored."
      : detail.reviews.map((item) => item.title).join(", ");
  return {
    ...mapRiskListItem(detail),
    scenario: detail.statement,
    businessImpact: detail.methodology_label,
    treatmentDetail: detail.treatment_notes ?? "No treatment notes are stored.",
    linkedRecords: `${mapRiskListItem(detail).linkedRecords} Evidence: ${evidence}. Reviews: ${reviews}.`,
  };
}

export function riskMetrics(items: RiskListItem[]): OverviewMetric[] {
  const open = items.filter((item) => !closed(item.status)).length;
  const critical = items.filter((item) => item.risk_level === "critical").length;
  return [
    {
      id: "open-risks",
      label: "Open risks",
      primaryValue: String(open),
      secondaryLabel: "Stored risk records",
      secondaryValue: String(items.length),
      tone: "accent",
      freshness: items.length === 0 ? "empty" : "fresh",
      semantics:
        "Risk records whose status is not closed or resolved. Not an aggregate security score.",
    },
    {
      id: "high-residual",
      label: "Critical inherent risk",
      primaryValue: String(critical),
      secondaryLabel: "Likelihood × impact band",
      secondaryValue: "16–25",
      tone: "warning",
      freshness: "fresh",
      semantics:
        "Records whose stored score, likelihood × impact, is in the critical band. Residual likelihood and impact are separate and are not filled in when absent.",
    },
    {
      id: "treatment-overdue",
      label: "Treatment overdue",
      primaryValue: "—",
      secondaryLabel: "Due dates",
      secondaryValue: "Not stored",
      tone: "warning",
      freshness: "empty",
      semantics: "The risk API does not return treatment due dates. No overdue count is invented.",
    },
    {
      id: "reviews-due",
      label: "Reviews due",
      primaryValue: "—",
      secondaryLabel: "Review schedule",
      secondaryValue: "Not stored",
      tone: "warning",
      freshness: "empty",
      semantics: "Review dates are not on the risk list. An empty review list is an absence.",
    },
  ];
}

export function mapRiskInventory(items: RiskListItem[], generatedAt: string): RiskSnapshot {
  return {
    dataClassification: "SIMULATED",
    generatedAt,
    lastSuccessfulFetchAt: generatedAt,
    environmentLabel: "Development · Seeded",
    snapshotLabel: "DEVELOPMENT / SEEDED",
    metrics: riskMetrics(items),
    risks: items.map(mapRiskListItem),
    interpretationNotes: [
      "Score is likelihood × impact. Likelihood, impact, and score stay separate. This is an AegisBridge internal method, not a NIST formula.",
      "Residual likelihood and impact are shown only when the API returns them.",
      "Counts come from the development database. Demo fixture totals are not mixed in.",
    ],
  };
}
