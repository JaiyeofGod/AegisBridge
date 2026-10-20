export type MetricFreshness = "fresh" | "updating" | "stale" | "error" | "empty";

export type OverviewMetric = {
  id: string;
  label: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  tone: "neutral" | "critical" | "warning" | "success" | "accent";
  freshness: MetricFreshness;
  semantics: string;
};

export type WorkItem = {
  id: string;
  title: string;
  meta: string;
  statusLabel: string;
  statusTone: "critical" | "warning" | "success" | "neutral";
};

export type OverviewSnapshot = {
  dataClassification: "SIMULATED";
  generatedAt: string;
  lastSuccessfulFetchAt: string;
  environmentLabel: string;
  metrics: OverviewMetric[];
  myWork: WorkItem[];
  securityHighlights: { id: string; title: string; detail: string }[];
  executiveNotes: { id: string; title: string; detail: string }[];
};
