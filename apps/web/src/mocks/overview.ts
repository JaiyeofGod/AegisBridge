import type { OverviewSnapshot } from "@/types/overview";

/** Deterministic synthetic Overview data. Always labeled SIMULATED. */
export const overviewMock: OverviewSnapshot = {
  dataClassification: "SIMULATED",
  generatedAt: "2026-10-20T08:00:00.000Z",
  lastSuccessfulFetchAt: "2026-10-20T08:00:00.000Z",
  environmentLabel: "Demo · AegisBridge Technologies",
  metrics: [
    {
      id: "kev-exposed",
      label: "KEV exposed assets",
      primaryValue: "7",
      secondaryLabel: "Unique KEV CVEs",
      secondaryValue: "4",
      tone: "critical",
      freshness: "fresh",
      semantics:
        "Count of assets linked to CISA KEV entries in the current inventory scope. Not a composite score.",
    },
    {
      id: "open-incidents",
      label: "Open incidents",
      primaryValue: "3",
      secondaryLabel: "Active investigations",
      secondaryValue: "2",
      tone: "warning",
      freshness: "fresh",
      semantics: "Incidents not yet closed in the reporting period. Denominator is open set only.",
    },
    {
      id: "control-effectiveness",
      label: "Control effectiveness",
      primaryValue: "72 / 96",
      secondaryLabel: "Passing assessed applicable controls",
      secondaryValue: "75%",
      tone: "accent",
      freshness: "fresh",
      semantics:
        "72 of 96 assessed applicable controls currently passing. Missing assessments are excluded from the denominator.",
    },
    {
      id: "telemetry-coverage",
      label: "Telemetry coverage",
      primaryValue: "119 / 128",
      secondaryLabel: "Expected assets active (24h)",
      secondaryValue: "93%",
      tone: "success",
      freshness: "fresh",
      semantics:
        "Assets with expected telemetry that reported activity in the last 24 hours. Unknown hosts are not counted as healthy zeros.",
    },
  ],
  myWork: [
    {
      id: "work-1",
      title: "Triage INC-001 repeated authentication failures",
      meta: "SOC · Due today",
      statusLabel: "In progress",
      statusTone: "warning",
    },
    {
      id: "work-2",
      title: "Review KEV exposure on FIN-APP-01",
      meta: "Vulnerability · High criticality asset",
      statusLabel: "Needs decision",
      statusTone: "critical",
    },
    {
      id: "work-3",
      title: "Close evidence gap for AC-2 access reviews",
      meta: "GRC · Control test",
      statusLabel: "Queued",
      statusTone: "neutral",
    },
  ],
  securityHighlights: [
    {
      id: "sec-1",
      title: "Priority actions",
      detail: "4 remediation tasks exceed internal SLA for KEV-linked assets.",
    },
    {
      id: "sec-2",
      title: "Integration freshness",
      detail: "Vulnerability intelligence last synced 42 minutes ago (simulated).",
    },
    {
      id: "sec-3",
      title: "Assessment progress",
      detail: "96 of 112 applicable controls assessed in the current profile cycle.",
    },
  ],
  executiveNotes: [
    {
      id: "exec-1",
      title: "Residual risk posture",
      detail:
        "Critical residual risks remain concentrated in privileged access and endpoint telemetry gaps.",
    },
    {
      id: "exec-2",
      title: "Program narrative",
      detail:
        "AegisBridge Technologies is a fictional portfolio organization. All dashboard figures are simulated demo data.",
    },
  ],
};
