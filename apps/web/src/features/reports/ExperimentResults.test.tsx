import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRouter } from "@/app/router";
import type { DatasetDetail, ExperimentDetail, ExperimentListItem } from "@/services/api-types";
import {
  assetPage,
  datasetItems,
  experimentDetail,
  experimentItems,
  installApiFetch,
  jsonResponse,
  reportsSummary,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

const FINGERPRINT = "de5b492458c1173d4f267ec8c8ea301d224ba4dd4fd03a41859c66d8819a75f2";
const REVISION = "eca603e0ecd4f698f8d4d226c088659e72681239";
const MODEL_HASH = "f6a69c3b87b79ed36a6e27c2ebaf91fbdda247bd3f4cf39504be4c9b4cac5987";
const VOCAB_HASH = "b32c702d383dfa1ba773d09acdf303169f5822f08efa399760620ff71f8ade96";
const MANIFEST_HASH = "4bbdac6c4bb6fec5e81048abc47b2acd2c5e2346d2390049926026406f3a0170";

const rsch0005List: ExperimentListItem = {
  id: "RSCH-0005",
  name: "PhreshPhish URL n-gram FFN",
  status: "completed",
  experiment_type: "url_ngram_ffn",
  approach: "URL character 4-gram binary bag-of-words, CPU FFN",
  metrics_summary: "accuracy 0.8250; phishing caught 75/100; benign false positives 10/100",
  started_at: "2026-10-25T01:36:31Z",
  completed_at: "2026-10-25T01:36:32Z",
  notes: "Deterministic configuration and pinned inputs.",
  dataset: {
    id: "DS-0006",
    title: "PhreshPhish",
    status: "not_downloaded",
    summary: null,
  },
};

const rsch0005: ExperimentDetail = {
  ...rsch0005List,
  dataset_version_label: FINGERPRINT,
  experiment_profile: "phreshphish-url-ffn-v1",
  derivation_fingerprint: FINGERPRINT,
  feature_config: {
    pipeline: "url-char-ngram-bow-v1",
    ngram_length: 4,
    min_count_exclusive: 10,
    max_features: 5000,
    representation: "binary",
    vocabulary_fit: "train_only",
    vocabulary_size: 464,
    index_zero_included: true,
    final_ngram_included: true,
  },
  model_settings: {
    framework: "numpy",
    device: "cpu",
    hidden_units: 32,
    activation: "relu",
    output: "sigmoid",
    optimizer: "adam",
    learning_rate: 0.001,
    epochs: 10,
    batch_size: 32,
    threshold: 0.5,
    parameter_count: 14913,
  },
  metrics: {
    accuracy: 0.825,
    precision: 0.8823529411764706,
    recall: 0.75,
    f1: 0.8108108108108107,
    phishing_caught: 75,
    phishing_support: 100,
    benign_false_positives: 10,
    benign_support: 100,
  },
  confusion_matrix: {
    labels: ["benign", "phish"],
    matrix: [
      [90, 10],
      [25, 75],
    ],
    true_negative: 90,
    false_positive: 10,
    false_negative: 25,
    true_positive: 75,
  },
  model_sha256: MODEL_HASH,
  vocabulary_sha256: VOCAB_HASH,
  manifest_sha256: MANIFEST_HASH,
};

function phreshDataset(): DatasetDetail {
  const item = datasetItems.find((row) => row.id === "DS-0006") ?? datasetItems[0];
  return {
    ...item,
    versions: [
      {
        version_label: "registry",
        file_count: 0,
        experiment_count: 0,
        created_at: "2026-10-19T20:00:00Z",
      },
      {
        version_label: FINGERPRINT,
        file_count: 3,
        experiment_count: 1,
        created_at: "2026-10-24T20:00:00Z",
        source_revision: REVISION,
        derived: true,
        derivation_profile: "phreshphish-url-baseline-v1",
        derivation_fingerprint: FINGERPRINT,
        column_count: 2,
        split_label_counts: {
          train: { benign: 557, phish: 443 },
          test: { benign: 100, phish: 100 },
        },
      },
    ],
    files: [],
    experiments: [],
  };
}

function installResearch(options?: { detailStatus?: number; notes?: string }) {
  const experiments = [...experimentItems, rsch0005List];
  return installApiFetch((url) => {
    if (url.includes("/api/v1/reports/summary")) return jsonResponse(reportsSummary);
    if (url.includes("/api/v1/dataset-experiments/RSCH-0005")) {
      if (options?.detailStatus) {
        return jsonResponse({ message: "unavailable" }, options.detailStatus);
      }
      return jsonResponse(options?.notes ? { ...rsch0005, notes: options.notes } : rsch0005);
    }
    if (/\/api\/v1\/dataset-experiments\/[^/?]+/.test(url)) {
      const id = url.split("/dataset-experiments/")[1]?.split("?")[0] ?? "";
      return jsonResponse(experimentDetail(decodeURIComponent(id)));
    }
    if (url.includes("/api/v1/dataset-experiments")) return jsonResponse(assetPage(experiments));
    if (/\/api\/v1\/datasets\/DS-0006/.test(url)) return jsonResponse(phreshDataset());
    return undefined;
  });
}

async function openResearch() {
  const user = userEvent.setup();
  await renderWithProviders(<AppRouter />, { initialEntries: ["/reports"] });
  const page = await screen.findByTestId("reports-page");
  await user.click(await within(page).findByRole("tab", { name: "Research" }));
  return { user, page };
}

describe("Research experiment results", () => {
  it("shows RSCH-0005 provenance, pipeline, model, metrics, and hashes", async () => {
    installResearch();
    const { user, page } = await openResearch();
    await user.click(within(page).getByRole("button", { name: /RSCH-0005/ }));
    const detail = await within(page).findByTestId("experiment-detail");

    expect(detail).toHaveTextContent("Completed");
    expect(detail).toHaveTextContent("phreshphish-url-ffn-v1");
    expect(detail).toHaveTextContent("PhreshPhish");
    expect(detail).toHaveTextContent("DS-0006");
    expect(detail).toHaveTextContent("phreshphish/phreshphish");
    expect(detail).toHaveTextContent(REVISION);
    expect(detail).toHaveTextContent("phreshphish-url-baseline-v1");
    expect(detail).toHaveTextContent(FINGERPRINT);
    expect(detail).toHaveTextContent("1,000");
    expect(detail).toHaveTextContent("200");
    expect(detail).toHaveTextContent("100 benign / 100 phish");
    expect(detail).toHaveTextContent("url, label");
    expect(detail).toHaveTextContent("The full 36.6 GB source dataset was not ingested.");

    const features = within(detail).getByTestId("experiment-features");
    expect(features).toHaveTextContent("4");
    expect(features).toHaveTextContent("464");
    expect(features).toHaveTextContent("5,000");
    expect(features).toHaveTextContent(">10");
    expect(features).toHaveTextContent("Binary presence");
    expect(features).toHaveTextContent("Training split only");
    expect(features).toHaveTextContent(
      "The vocabulary is fit only on training URLs to prevent test-data leakage.",
    );
    expect(features).toHaveTextContent("Ignored");
    expect(features).toHaveTextContent("Enabled");
    expect(within(detail).getByTestId("indexing-note")).toHaveTextContent("feature index 0");
    expect(within(detail).getByTestId("indexing-note")).toHaveTextContent("final character window");

    const model = within(detail).getByTestId("experiment-model");
    expect(model).toHaveTextContent("Input → 32 ReLU → 1 sigmoid");
    expect(model).toHaveTextContent("14,913");
    expect(model).toHaveTextContent("Adam");
    expect(model).toHaveTextContent("0.001");
    expect(model).toHaveTextContent("10");
    expect(model).toHaveTextContent("32");
    expect(model).toHaveTextContent("0.5");
    expect(model).toHaveTextContent("42");
    expect(model).toHaveTextContent("CPU");
    expect(model).toHaveTextContent("NumPy");
    expect(model).not.toHaveTextContent("PyTorch");

    const evaluation = within(detail).getByTestId("experiment-evaluation");
    expect(evaluation).toHaveTextContent("82.5%");
    expect(evaluation).toHaveTextContent("88.2%");
    expect(evaluation).toHaveTextContent("75.0%");
    expect(evaluation).toHaveTextContent("81.1%");
    expect(evaluation).toHaveTextContent("75 / 100");
    expect(evaluation).toHaveTextContent("10 / 100");

    const matrix = within(detail).getByTestId("confusion-matrix");
    expect(matrix).toHaveTextContent("Actual benign");
    expect(matrix).toHaveTextContent("Actual phish");
    expect(matrix).toHaveTextContent("Predicted benign");
    expect(matrix).toHaveTextContent("Predicted phish");
    expect(matrix).toHaveTextContent("90 true negatives");
    expect(matrix).toHaveTextContent("10 false positives");
    expect(matrix).toHaveTextContent("25 false negatives");
    expect(matrix).toHaveTextContent("75 true positives");

    const comparison = within(detail).getByTestId("experiment-comparison");
    expect(comparison).toHaveTextContent("79%");
    expect(comparison).toHaveTextContent("64/100");
    expect(comparison).toHaveTextContent("6/100");
    expect(comparison).toHaveTextContent("82.5%");
    expect(comparison).toHaveTextContent("75/100");
    expect(comparison).toHaveTextContent("10/100");
    expect(comparison).toHaveTextContent(
      "RSCH-0005 measured higher accuracy and phishing recall, while also producing more benign false positives.",
    );
    expect(comparison).toHaveTextContent(
      "These are not directly controlled before-and-after experiments.",
    );
    expect(comparison).not.toHaveTextContent("improvement");

    expect(within(detail).getByTestId("experiment-limits")).toHaveTextContent(
      "not a reproduction of the full PhreshPhish paper",
    );
    expect(detail).toHaveTextContent(MODEL_HASH);
    expect(detail).toHaveTextContent(VOCAB_HASH);
    expect(detail).toHaveTextContent(MANIFEST_HASH);
    expect(detail).toHaveTextContent(
      "SHA-256 values are integrity hashes, not digital signatures.",
    );
    expect(detail).not.toHaveTextContent("Download");
  });

  it("keeps a legacy experiment free of invented results", async () => {
    installResearch();
    const { user, page } = await openResearch();
    await user.click(within(page).getByRole("button", { name: /RSCH-0001/ }));
    const detail = await within(page).findByTestId("experiment-detail");
    expect(detail).toHaveTextContent(
      "No evaluation metrics have been recorded for this experiment.",
    );
    expect(within(detail).queryByTestId("confusion-matrix")).not.toBeInTheDocument();
    expect(within(detail).queryByTestId("experiment-comparison")).not.toBeInTheDocument();
    expect(detail).not.toHaveTextContent(MODEL_HASH);
    expect(detail).not.toHaveTextContent("82.5%");
    expect(detail).toHaveTextContent("Not recorded");
  });

  it("renders untrusted text without executing markup or showing private paths", async () => {
    installResearch({
      notes:
        "<img src=x onerror=alert(1)><script>alert(1)</script> https://evil.example/phish experiments/RSCH-0005/model.bin 123e4567-e89b-12d3-a456-426614174000",
    });
    const { user, page } = await openResearch();
    await user.click(within(page).getByRole("button", { name: /RSCH-0005/ }));
    const detail = await within(page).findByTestId("experiment-detail");
    expect(detail.querySelector("img")).toBeNull();
    expect(detail.querySelector("script")).toBeNull();
    expect(detail.innerHTML).not.toContain("<img");
    expect(detail.innerHTML).not.toContain("<script");
    expect(detail).not.toHaveTextContent("https://evil.example/phish");
    expect(detail).not.toHaveTextContent("experiments/RSCH-0005/model.bin");
    expect(detail).not.toHaveTextContent("123e4567-e89b-12d3-a456-426614174000");
    expect(detail).toHaveTextContent("[link removed]");
  });

  it("shows a permission failure without a stack trace", async () => {
    installResearch({ detailStatus: 403 });
    const { user, page } = await openResearch();
    await user.click(within(page).getByRole("button", { name: /RSCH-0005/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You do not have permission to read research experiments.");
    expect(alert.textContent ?? "").not.toMatch(/traceback/i);
  });

  it("shows a missing experiment without a stack trace", async () => {
    installResearch({ detailStatus: 404 });
    const { user, page } = await openResearch();
    await user.click(within(page).getByRole("button", { name: /RSCH-0005/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This experiment is no longer available.");
    expect(alert.textContent ?? "").not.toMatch(/traceback/i);
  });

  it("shows a server failure without a stack trace", async () => {
    installResearch({ detailStatus: 500 });
    const { user, page } = await openResearch();
    await user.click(within(page).getByRole("button", { name: /RSCH-0005/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Unable to load experiment");
    expect(alert.textContent ?? "").not.toMatch(/traceback/i);
  });
});
