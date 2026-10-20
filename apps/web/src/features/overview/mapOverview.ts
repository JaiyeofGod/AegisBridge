import type { OverviewResponse } from "@/services/api-types";
import type { OverviewMetric, OverviewSnapshot, WorkItem } from "@/types/overview";

function label(value: string) {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function workTone(status: string): WorkItem["statusTone"] {
  const normalized = status.toLowerCase();
  if (normalized.includes("critical") || normalized === "act") return "critical";
  if (normalized === "open" || normalized === "investigating" || normalized === "in_progress") {
    return "warning";
  }
  if (normalized === "closed" || normalized === "complete") return "success";
  return "neutral";
}

export function mapOverview(response: OverviewResponse): OverviewSnapshot {
  const incidents = response.my_work.filter((item) => item.kind === "incident").length;
  const telemetryAbsent = response.telemetry.active === 0;
  const metrics: OverviewMetric[] = [
    {
      id: "kev-exposed",
      label: "KEV exposed assets",
      primaryValue: String(response.kev_exposure.exposed_asset_count),
      secondaryLabel: "Unique KEV CVEs",
      secondaryValue: String(response.kev_exposure.distinct_cve_count),
      tone: "critical",
      freshness: "fresh",
      semantics: response.kev_exposure.semantics,
    },
    {
      id: "open-incidents",
      label: "Open incidents",
      primaryValue: String(response.open_incidents),
      secondaryLabel: "Open incident work items",
      secondaryValue: String(incidents),
      tone: "warning",
      freshness: "fresh",
      semantics: "Incidents whose status is not resolved or closed. Not a security score.",
    },
    {
      id: "control-effectiveness",
      label: "Control effectiveness",
      primaryValue: `${response.control_posture.passed} / ${response.control_posture.assessed_applicable}`,
      secondaryLabel: "Passing assessed applicable controls",
      secondaryValue:
        response.control_posture.assessed_applicable === 0
          ? "—"
          : `${Math.round((response.control_posture.passed / response.control_posture.assessed_applicable) * 100)}%`,
      tone: "accent",
      freshness: response.control_posture.assessed_applicable === 0 ? "empty" : "fresh",
      semantics: response.control_posture.semantics,
    },
    {
      id: "telemetry-coverage",
      label: "Telemetry coverage",
      primaryValue: `${response.telemetry.active} / ${response.telemetry.expected}`,
      secondaryLabel: "Expected assets with active telemetry",
      secondaryValue: telemetryAbsent ? "Not connected" : `${response.telemetry.active}`,
      tone: telemetryAbsent ? "warning" : "success",
      freshness: telemetryAbsent ? "empty" : "fresh",
      semantics: response.telemetry.semantics,
    },
  ];

  return {
    dataClassification: "SIMULATED",
    generatedAt: response.generated_at,
    lastSuccessfulFetchAt: response.generated_at,
    environmentLabel: "Development · Seeded",
    metrics,
    myWork: response.my_work.map((item) => ({
      id: `${item.kind}-${item.id}`,
      title: item.title,
      meta: `${label(item.kind)} · ${item.owner?.display_name ?? "Unassigned"}`,
      statusLabel: label(item.status),
      statusTone: workTone(item.status),
    })),
    securityHighlights: response.security_highlights,
    executiveNotes: response.executive_notes,
  };
}
