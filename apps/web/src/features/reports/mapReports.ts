import { formatTimestamp } from "@/lib/format";
import type {
  DatasetDetail,
  DatasetListItem,
  ExperimentDetail,
  ExperimentListItem,
  ReportDefinitionDetail,
  ReportDefinitionListItem,
  ReportsSummary,
} from "@/services/api-types";
import type { OverviewMetric } from "@/types/overview";

export type ReportDefinitionView = {
  id: string;
  name: string;
  description: string;
  reportType: string;
  reportTypeLabel: string;
  status: string;
  statusLabel: string;
  scheduleState: string;
  scheduleStateLabel: string;
  scheduleLabel: string;
  formatLabel: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string;
  nextRunAt: string;
  generatedFiles: string[];
  hasGeneratedFiles: boolean;
};

export type DatasetView = {
  id: string;
  name: string;
  description: string;
  publisher: string;
  sourceLabel: string;
  sourceUrl: string;
  publicationYear: string;
  domain: string;
  licenseLabel: string;
  status: string;
  statusLabel: string;
  verificationStatus: string;
  verificationLabel: string;
  purpose: string;
  sizeLabel: string;
  rowCount: string;
  featureCount: string;
  fileCount: number;
  versionCount: number;
  experimentCount: number;
  notes: string;
  registryOnly: boolean;
};

export type DatasetDetailView = DatasetView & {
  versions: Array<{
    versionLabel: string;
    fileCount: number;
    experimentCount: number;
    createdAt: string;
  }>;
  files: Array<{
    filename: string;
    sha256: string;
    sizeBytes: string;
    hasStorageUri: boolean;
  }>;
  experiments: Array<{
    id: string;
    name: string;
    status: string;
    experimentType: string;
  }>;
};

export type ExperimentView = {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  experimentType: string;
  approach: string;
  metricsSummary: string;
  hasMetrics: boolean;
  startedAt: string;
  completedAt: string;
  notes: string;
  datasetId: string;
  datasetTitle: string;
  datasetVersionLabel: string;
};

export type CountRow = {
  id: string;
  measure: string;
  value: string;
  window: string;
};

const reportTypeLabels: Record<string, string> = {
  executive_security_summary: "Executive security summary",
  vulnerability_exposure: "Vulnerability exposure",
  risk_register: "Risk register",
  control_assessment: "Control assessment",
  incident_summary: "Incident summary",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  review: "Review",
  archived: "Archived",
  not_downloaded: "Not downloaded",
  verification_required: "Verification required",
  not_reviewed: "Not reviewed",
  reviewed: "Reviewed",
  completed: "Completed",
  planned: "Planned",
  schedule_defined: "Schedule defined",
  not_scheduled: "Not scheduled",
};

function labelStored(value: string | null | undefined, fallback = "Not recorded") {
  if (value == null || value.trim().length === 0) return fallback;
  return statusLabels[value] ?? value;
}

function optionalText(value: string | null | undefined, fallback = "Not recorded") {
  if (value == null || value.trim().length === 0) return fallback;
  return value;
}

function optionalNumber(value: number | null | undefined, fallback = "Not recorded") {
  if (value == null) return fallback;
  return String(value);
}

function optionalTimestamp(value: string | null | undefined, fallback = "Not recorded") {
  if (value == null) return fallback;
  return formatTimestamp(value);
}

export function mapReportsSummary(summary: ReportsSummary): {
  metrics: OverviewMetric[];
  counts: CountRow[];
  notes: string[];
} {
  return {
    metrics: [
      {
        id: "definitions",
        label: "Saved report definitions",
        primaryValue: String(summary.report_definition_count),
        secondaryLabel: "With schedule cadence",
        secondaryValue: String(summary.scheduled_report_count),
        tone: "accent",
        freshness: "fresh",
        semantics:
          "Stored report definition rows. A schedule cadence label is not a running scheduler.",
      },
      {
        id: "executions",
        label: "Completed report runs",
        primaryValue: String(summary.completed_report_count),
        secondaryLabel: "Failed / recent executions",
        secondaryValue: `${summary.failed_report_count} / ${summary.recent_execution_count}`,
        tone: summary.completed_report_count === 0 ? "neutral" : "accent",
        freshness: summary.completed_report_count === 0 ? "empty" : "fresh",
        semantics:
          "Execution counts stay at zero when no report execution or export rows are stored.",
      },
      {
        id: "datasets",
        label: "Dataset registry",
        primaryValue: String(summary.dataset_count),
        secondaryLabel: "Quality review required",
        secondaryValue: String(summary.dataset_quality_review_count),
        tone: summary.dataset_quality_review_count > 0 ? "warning" : "accent",
        freshness: "fresh",
        semantics:
          "Registry metadata only unless files are stored. not_downloaded is not locally available.",
      },
      {
        id: "experiments",
        label: "Dataset experiments",
        primaryValue: String(summary.experiment_count),
        secondaryLabel: "Stored research metadata",
        secondaryValue: String(summary.experiment_count),
        tone: "accent",
        freshness: "fresh",
        semantics: "Experiment rows are development metadata. Metrics are shown exactly as stored.",
      },
    ],
    counts: [
      {
        id: "definitions",
        measure: "Saved report definitions",
        value: String(summary.report_definition_count),
        window: "Stored catalog",
      },
      {
        id: "scheduled",
        measure: "Schedule-defined definitions",
        value: String(summary.scheduled_report_count),
        window: "Cadence label only — no worker",
      },
      {
        id: "completed",
        measure: "Completed report executions",
        value: String(summary.completed_report_count),
        window: "No execution rows stored",
      },
      {
        id: "failed",
        measure: "Failed report executions",
        value: String(summary.failed_report_count),
        window: "No execution rows stored",
      },
      {
        id: "recent",
        measure: "Recent executions",
        value: String(summary.recent_execution_count),
        window: "No execution rows stored",
      },
      {
        id: "datasets",
        measure: "Dataset registry entries",
        value: String(summary.dataset_count),
        window: "Metadata unless files stored",
      },
      {
        id: "quality",
        measure: "Datasets needing quality review",
        value: String(summary.dataset_quality_review_count),
        window: "verification_status only",
      },
      {
        id: "experiments",
        measure: "Dataset experiments",
        value: String(summary.experiment_count),
        window: "Stored research metadata",
      },
    ],
    notes: [
      summary.semantics,
      "Report definitions are development metadata. No report worker or scheduler is running.",
      "Datasets are registry entries unless files are actually stored. No download pipeline is connected.",
      "Experiments are stored development metadata. Metric text is not a stronger performance claim.",
      "Create report and export actions stay disconnected in this phase.",
    ],
  };
}

export function mapReportDefinition(
  item: ReportDefinitionListItem | ReportDefinitionDetail,
): ReportDefinitionView {
  const generatedFiles = "generated_files" in item ? item.generated_files : [];
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    reportType: item.report_type,
    reportTypeLabel: reportTypeLabels[item.report_type] ?? item.report_type,
    status: item.status,
    statusLabel: labelStored(item.status),
    scheduleState: item.schedule_state,
    scheduleStateLabel: labelStored(item.schedule_state),
    scheduleLabel: optionalText(item.schedule_label, "No cadence stored"),
    formatLabel: optionalText(item.format_label),
    owner: item.owner?.display_name ?? "Not recorded",
    createdAt: formatTimestamp(item.created_at),
    updatedAt: formatTimestamp(item.updated_at),
    lastRunAt: optionalTimestamp(item.last_run_at),
    nextRunAt: optionalTimestamp(item.next_run_at),
    generatedFiles,
    hasGeneratedFiles: generatedFiles.length > 0,
  };
}

export function mapDataset(item: DatasetListItem | DatasetDetail): DatasetView {
  return {
    id: item.id,
    name: item.name,
    description: optionalText(item.description),
    publisher: optionalText(item.publisher),
    sourceLabel: optionalText(item.source_label),
    sourceUrl: optionalText(item.source_url, "No source URL stored"),
    publicationYear: item.publication_year == null ? "Not recorded" : String(item.publication_year),
    domain: optionalText(item.domain),
    licenseLabel: optionalText(item.license_label),
    status: item.status,
    statusLabel: labelStored(item.status),
    verificationStatus: item.verification_status ?? "not_reviewed",
    verificationLabel: labelStored(item.verification_status, "Not reviewed"),
    purpose: optionalText(item.purpose),
    sizeLabel: optionalText(item.size_label),
    rowCount: optionalNumber(item.row_count),
    featureCount: optionalNumber(item.feature_count),
    fileCount: item.file_count,
    versionCount: item.version_count,
    experimentCount: item.experiment_count,
    notes: optionalText(item.notes, "No notes stored"),
    registryOnly: item.file_count === 0,
  };
}

export function mapDatasetDetail(item: DatasetDetail): DatasetDetailView {
  return {
    ...mapDataset(item),
    versions: item.versions.map((version) => ({
      versionLabel: version.version_label,
      fileCount: version.file_count,
      experimentCount: version.experiment_count,
      createdAt: formatTimestamp(version.created_at),
    })),
    files: item.files.map((file) => ({
      filename: file.filename,
      sha256: optionalText(file.sha256),
      sizeBytes: optionalNumber(file.size_bytes),
      hasStorageUri: file.has_storage_uri,
    })),
    experiments: item.experiments.map((experiment) => ({
      id: experiment.id,
      name: experiment.name,
      status: experiment.status,
      experimentType: optionalText(experiment.experiment_type),
    })),
  };
}

export function mapExperiment(item: ExperimentListItem | ExperimentDetail): ExperimentView {
  const metrics = item.metrics_summary;
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    statusLabel: labelStored(item.status),
    experimentType: optionalText(item.experiment_type),
    approach: optionalText(item.approach),
    metricsSummary: optionalText(metrics, "No metrics or results are stored."),
    hasMetrics: metrics != null && metrics.trim().length > 0,
    startedAt: optionalTimestamp(item.started_at),
    completedAt: optionalTimestamp(item.completed_at),
    notes: optionalText(item.notes, "No notes stored"),
    datasetId: item.dataset.id,
    datasetTitle: item.dataset.title,
    datasetVersionLabel:
      "dataset_version_label" in item
        ? optionalText(item.dataset_version_label, "Not recorded")
        : "Not recorded",
  };
}

export function reportStatusTone(status: string): "success" | "warning" | "accent" | "neutral" {
  if (status === "ready") return "success";
  if (status === "review" || status === "draft") return "warning";
  if (status === "archived") return "neutral";
  return "accent";
}
