import type { GovernanceSummary } from "@/services/api-types";
import type { GovernanceStatusTone } from "@/types/governance";
import type { OverviewMetric } from "@/types/overview";

export type GovernanceFrameworkView = {
  id: string;
  code: string;
  name: string;
  version: string;
  role: string;
  storedControlCount: number;
  licensedTextIncluded: boolean;
  currentProfileLabel: string;
  targetProfileLabel: string;
  notes: string;
};

export type GovernanceStatusCount = {
  status: string;
  count: number;
};

export type GovernancePolicyView = {
  id: string;
  title: string;
  version: string;
  owner: string;
  statusLabel: string;
  statusTone: GovernanceStatusTone;
  acknowledgementCount: number;
};

export type GovernanceAccessReviewView = {
  id: string;
  name: string;
  statusLabel: string;
  statusTone: GovernanceStatusTone;
  openFindings: number;
  totalFindings: number;
};

export type GovernanceAssessmentView = {
  id: string;
  name: string;
  frameworkScope: string;
  owner: string;
  statusLabel: string;
  statusTone: GovernanceStatusTone;
};

export type GovernanceView = {
  generatedAt: string;
  metrics: OverviewMetric[];
  frameworks: GovernanceFrameworkView[];
  statusCounts: GovernanceStatusCount[];
  testsPassed: number;
  testsRecorded: number;
  assessedApplicable: number;
  evidence: GovernanceSummary["evidence_freshness"];
  assessments: GovernanceAssessmentView[];
  policies: GovernancePolicyView[];
  accessReviews: GovernanceAccessReviewView[];
  interpretationNotes: string[];
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function frameworkRole(framework: GovernanceSummary["frameworks"][number]) {
  const key = `${framework.code} ${framework.name}`.toLowerCase();
  if (key.includes("csf") || key.includes("cybersecurity framework")) {
    return "Top-level organizational framework";
  }
  if (key.includes("cis")) return "Identifiers, status, and mappings only";
  if (key.includes("asvs")) return "Application-security verification baseline";
  if (key.includes("800-53")) return "Selected NIST SP 800-53 controls";
  return "Framework returned by the development summary";
}

function statusTone(status: string): GovernanceStatusTone {
  const value = status.toLowerCase();
  if (value === "pass" || value === "passed" || value === "implemented") return "success";
  if (value === "partial" || value === "draft" || value === "in_progress") return "warning";
  if (value === "not_implemented" || value === "fail" || value === "failed") return "critical";
  return "neutral";
}

export function mapGovernanceSummary(
  summary: GovernanceSummary,
  generatedAt: string,
): GovernanceView {
  const counts = summary.control_implementations;
  const testsMissing = counts.tests_recorded === 0;
  return {
    generatedAt,
    metrics: governanceMetrics(summary),
    frameworks: summary.frameworks.map((framework) => ({
      id: framework.code,
      code: framework.code,
      name: framework.name,
      version: framework.version ?? "Not stored",
      role: frameworkRole(framework),
      storedControlCount: framework.control_count,
      licensedTextIncluded: framework.licensed_text_included,
      currentProfileLabel: "Not stored",
      targetProfileLabel: "Not stored",
      notes: framework.licensed_text_included
        ? "This summary included licensed text. It should not be displayed."
        : "Licensed control text is not included. The count is the number of controls stored for this framework version.",
    })),
    statusCounts: Object.entries(counts.by_status).map(([status, count]) => ({
      status: titleCase(status),
      count,
    })),
    testsPassed: counts.tests_passed,
    testsRecorded: counts.tests_recorded,
    assessedApplicable: counts.assessed_applicable,
    evidence: summary.evidence_freshness,
    assessments: summary.assessment_work.items.map((result, index) => ({
      id: `control-test-${index}`,
      name: titleCase(result),
      frameworkScope: "Stored control test result",
      owner: "Not recorded",
      statusLabel: titleCase(result),
      statusTone: statusTone(result),
    })),
    policies: summary.policies.map((policy) => ({
      id: policy.id,
      title: policy.title,
      version: policy.current_version ?? "Not stored",
      owner: policy.owner?.display_name ?? "Unassigned",
      statusLabel: titleCase(policy.status),
      statusTone: statusTone(policy.status),
      acknowledgementCount: policy.acknowledgement_count,
    })),
    accessReviews: summary.access_reviews.map((review) => ({
      id: review.id,
      name: review.name,
      statusLabel: titleCase(review.status),
      statusTone: statusTone(review.status),
      openFindings: review.open_findings,
      totalFindings: review.total_findings,
    })),
    interpretationNotes: [
      "Development seeded data. This is not live compliance data. Evidence collectors, an identity provider, ticketing, and external GRC systems are not connected.",
      "NIST CSF 2.0 is the top-level framework. CIS Controls v8.1 are referenced by identifier, status, and mapping only. Licensed CIS text is not included.",
      "Selected NIST SP 800-53 Rev. 5 controls and OWASP ASVS 5.0.0 are shown when this summary returns them.",
      testsMissing
        ? "No control test results are stored. Passing controls are not inferred."
        : `${counts.tests_passed} of ${counts.tests_recorded} stored control tests passed. Untested controls are not treated as passing.`,
      summary.evidence_freshness.semantics,
      "There is no aggregate security score.",
    ],
  };
}

function governanceMetrics(summary: GovernanceSummary): OverviewMetric[] {
  const counts = summary.control_implementations;
  const testsMissing = counts.tests_recorded === 0;
  const statusLabel = Object.entries(counts.by_status)
    .map(([status, count]) => `${count} ${status.replaceAll("_", " ")}`)
    .join(", ");
  return [
    {
      id: "controls-passing",
      label: "Controls passing",
      primaryValue: testsMissing
        ? "Not recorded"
        : `${counts.tests_passed} / ${counts.tests_recorded}`,
      secondaryLabel: testsMissing ? "No control test results stored" : "Stored test results",
      secondaryValue: testsMissing ? "—" : String(counts.tests_passed),
      tone: "warning",
      freshness: testsMissing ? "empty" : "fresh",
      semantics: testsMissing
        ? "No control test results are stored. Passing controls are not inferred."
        : `${counts.tests_passed} passed of ${counts.tests_recorded} stored control tests. This is not an aggregate security score.`,
    },
    {
      id: "implementations",
      label: "Implementation status",
      primaryValue: String(counts.assessed_applicable),
      secondaryLabel: statusLabel || "No status stored",
      secondaryValue: String(
        Object.values(counts.by_status).reduce((sum, count) => sum + count, 0),
      ),
      tone: "accent",
      freshness: Object.keys(counts.by_status).length === 0 ? "empty" : "fresh",
      semantics:
        "Assessed applicable implementations returned by the summary. Status counts are separate from test results.",
    },
    {
      id: "evidence-freshness",
      label: "Evidence freshness",
      primaryValue: String(summary.evidence_freshness.recorded),
      secondaryLabel: "With SHA-256",
      secondaryValue: String(summary.evidence_freshness.with_sha256),
      tone: "accent",
      freshness: summary.evidence_freshness.recorded === 0 ? "empty" : "fresh",
      semantics: summary.evidence_freshness.semantics,
    },
    {
      id: "reviews",
      label: "Policies and reviews",
      primaryValue: String(summary.policies.length),
      secondaryLabel: "Access reviews stored",
      secondaryValue: String(summary.access_reviews.length),
      tone: "warning",
      freshness: summary.policies.length + summary.access_reviews.length === 0 ? "empty" : "fresh",
      semantics:
        "Policy and access-review records returned by the summary. Empty lists mean those records are not stored.",
    },
  ];
}
