import type { OverviewMetric } from "@/types/overview";

export type ReportSectionId = "overview" | "reports" | "exports" | "datasets" | "research";

export type ReportStatus = "Ready" | "Review" | "Scheduled";
export type ExportStatus = "Completed" | "Pending";
export type DownloadStatus = "Not downloaded" | "Not applicable";

export type ReportRecord = {
  id: string;
  reportId: string;
  name: string;
  type: string;
  owner: string;
  generatedLabel: string;
  freshness: string;
  status: ReportStatus;
  format: "PDF" | "CSV" | "JSON";
  scope: string;
  featured: boolean;
  schedule: string | null;
};

export type ExportRecord = {
  id: string;
  exportId: string;
  reportId: string;
  format: "PDF" | "CSV" | "JSON";
  status: ExportStatus;
  requestedLabel: string;
  note: string;
};

export type DatasetRecord = {
  id: string;
  datasetId: string;
  name: string;
  releaseYear: string;
  domain: string;
  sizeClass: string;
  license: string;
  downloadStatus: DownloadStatus;
  purpose: string;
  registryStatus: string;
};

export type ExperimentRecord = {
  id: string;
  experimentId: string;
  title: string;
  datasetId: string;
  objective: string;
  status: "Completed" | "Planned";
  lastRun: string;
  resultSummary: string;
  artifact: string;
};

export type CountRow = {
  id: string;
  measure: string;
  value: string;
  window: string;
};

export type ReportsSnapshot = {
  dataClassification: "SIMULATED";
  generatedAt: string;
  lastSuccessfulFetchAt: string;
  environmentLabel: string;
  snapshotLabel: string;
  metrics: OverviewMetric[];
  reports: ReportRecord[];
  exports: ExportRecord[];
  datasets: DatasetRecord[];
  experiments: ExperimentRecord[];
  counts: CountRow[];
  workflowNotes: string[];
};
