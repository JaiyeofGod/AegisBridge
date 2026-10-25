import { ApiError } from "@/services/api-client";
import type {
  DatasetDetail,
  ExperimentConfusionMatrix,
  ExperimentDetail,
  ExperimentFeatureConfig,
  ExperimentModelSettings,
} from "@/services/api-types";

export const URL_FFN_PROFILE = "phreshphish-url-ffn-v1";
export const URL_BASELINE_PROFILE = "phreshphish-url-baseline-v1";

const NOT_RECORDED = "Not recorded";

export type CountPair = {
  caught: number;
  support: number;
};

export type ConfusionCounts = {
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  truePositive: number;
};

export type ExperimentEvaluation = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  phishing: CountPair;
  benignFalsePositives: CountPair;
  confusion: ConfusionCounts;
};

export function isUrlFfn(detail: ExperimentDetail): boolean {
  return detail.experiment_profile === URL_FFN_PROFILE;
}

export function publicText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, "[link removed]")
    .replace(/\b(?:experiments|datasets)\/\S+/g, "[storage path removed]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[identifier removed]",
    );
}

export function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatGrouped(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatRate(value: number): string {
  return String(value);
}

export function readEvaluation(detail: ExperimentDetail): ExperimentEvaluation | null {
  const metrics = detail.metrics;
  if (!metrics) return null;
  const accuracy = finiteNumber(metrics.accuracy);
  const precision = finiteNumber(metrics.precision);
  const recall = finiteNumber(metrics.recall);
  const f1 = finiteNumber(metrics.f1);
  const confusion = readConfusion(detail.confusion_matrix ?? metrics.confusion_matrix);
  const phishing = readPair(metrics.phishing_caught, metrics.phishing_support);
  const benignFalsePositives = readPair(metrics.benign_false_positives, metrics.benign_support);
  if (
    accuracy == null ||
    precision == null ||
    recall == null ||
    f1 == null ||
    confusion == null ||
    phishing == null ||
    benignFalsePositives == null
  ) {
    return null;
  }
  return { accuracy, precision, recall, f1, phishing, benignFalsePositives, confusion };
}

export function readFeature(config: ExperimentFeatureConfig | null) {
  if (!config) return null;
  const length = finiteNumber(config.ngram_length);
  const vocabulary = finiteNumber(config.vocabulary_size);
  const maximum = finiteNumber(config.max_features);
  const minimum = finiteNumber(config.min_count_exclusive);
  if (length == null && vocabulary == null && maximum == null && minimum == null) return null;
  return {
    ngramLength: length,
    vocabulary,
    maximum,
    minimum,
    representation: textOrNull(config.representation),
    vocabularyFit: textOrNull(config.vocabulary_fit),
    correctedIndexing: config.index_zero_included === true && config.final_ngram_included === true,
    ignoresUnknownTestGrams: config.pipeline === "url-char-ngram-bow-v1",
  };
}

export function readModel(settings: ExperimentModelSettings | null) {
  if (!settings) return null;
  const hidden = finiteNumber(settings.hidden_units);
  const parameters = finiteNumber(settings.parameter_count);
  const learningRate = finiteNumber(settings.learning_rate);
  const epochs = finiteNumber(settings.epochs);
  const batchSize = finiteNumber(settings.batch_size);
  const threshold = finiteNumber(settings.threshold);
  if (
    hidden == null &&
    parameters == null &&
    learningRate == null &&
    epochs == null &&
    batchSize == null &&
    threshold == null &&
    !textOrNull(settings.framework) &&
    !textOrNull(settings.device)
  ) {
    return null;
  }
  return {
    hiddenUnits: hidden,
    activation: textOrNull(settings.activation),
    output: textOrNull(settings.output),
    parameters,
    optimizer: textOrNull(settings.optimizer),
    learningRate,
    epochs,
    batchSize,
    threshold,
    framework: textOrNull(settings.framework),
    device: textOrNull(settings.device),
  };
}

export function matchingVersion(dataset: DatasetDetail | undefined, versionLabel: string) {
  return dataset?.versions.find((version) => version.version_label === versionLabel) ?? null;
}

export function splitTotal(counts: Record<string, number> | undefined): number | null {
  if (!counts) return null;
  const values = Object.values(counts);
  if (values.length === 0 || values.some((value) => finiteNumber(value) == null)) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

export function displayText(value: string | null | undefined): string {
  const text = textOrNull(value);
  return text ? publicText(text) : NOT_RECORDED;
}

function readConfusion(
  matrix: ExperimentConfusionMatrix | null | undefined,
): ConfusionCounts | null {
  if (!matrix) return null;
  const trueNegative = finiteNumber(matrix.true_negative);
  const falsePositive = finiteNumber(matrix.false_positive);
  const falseNegative = finiteNumber(matrix.false_negative);
  const truePositive = finiteNumber(matrix.true_positive);
  if (
    trueNegative == null ||
    falsePositive == null ||
    falseNegative == null ||
    truePositive == null
  ) {
    return readMatrixCells(matrix.matrix);
  }
  return { trueNegative, falsePositive, falseNegative, truePositive };
}

function readMatrixCells(matrix: number[][] | undefined): ConfusionCounts | null {
  const trueNegative = finiteNumber(matrix?.[0]?.[0]);
  const falsePositive = finiteNumber(matrix?.[0]?.[1]);
  const falseNegative = finiteNumber(matrix?.[1]?.[0]);
  const truePositive = finiteNumber(matrix?.[1]?.[1]);
  if (
    trueNegative == null ||
    falsePositive == null ||
    falseNegative == null ||
    truePositive == null
  ) {
    return null;
  }
  return { trueNegative, falsePositive, falseNegative, truePositive };
}

function readPair(caught: number | undefined, support: number | undefined): CountPair | null {
  const left = finiteNumber(caught);
  const right = finiteNumber(support);
  if (left == null || right == null) return null;
  return { caught: left, support: right };
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function representationLabel(value: string | null): string {
  if (value === "binary") return "Binary presence";
  return value ? publicText(value) : NOT_RECORDED;
}

export function vocabularyFitLabel(value: string | null): string {
  if (value === "train_only") return "Training split only";
  return value ? publicText(value) : NOT_RECORDED;
}

export function frameworkLabel(value: string | null): string {
  if (value === "numpy") return "NumPy";
  return value ? publicText(value) : NOT_RECORDED;
}

export function deviceLabel(value: string | null): string {
  if (value === "cpu") return "CPU";
  return value ? publicText(value) : NOT_RECORDED;
}

export function optimizerLabel(value: string | null): string {
  if (value === "adam") return "Adam";
  return value ? publicText(value) : NOT_RECORDED;
}

export function outputLabel(value: string | null): string {
  if (value === "sigmoid") return "sigmoid";
  return value ? publicText(value) : NOT_RECORDED;
}

export function activationLabel(value: string | null): string {
  if (value === "relu") return "ReLU";
  return value ? publicText(value) : NOT_RECORDED;
}

export function experimentErrorCopy(error: unknown): { title: string; description: string } {
  if (error instanceof ApiError && error.status === 403) {
    return {
      title: "Research experiments are unavailable",
      description: "You do not have permission to read research experiments.",
    };
  }
  if (error instanceof ApiError && error.status === 404) {
    return {
      title: "Experiment unavailable",
      description: "This experiment is no longer available.",
    };
  }
  return {
    title: "Unable to load experiment",
    description: "The experiment request failed. Fixture results are not substituted.",
  };
}

export { NOT_RECORDED };
