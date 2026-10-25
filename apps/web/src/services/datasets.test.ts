import { describe, expect, it } from "vitest";

import { fetchDatasetExperiment, fetchDatasetExperiments } from "@/services/datasets";
import { installApiFetch, jsonResponse } from "@/test/api-fixtures";

const legacy = {
  id: "RSCH-0004",
  name: "Static phishing features",
  status: "planned",
  experiment_type: "static_feature_review",
  approach: "Static-feature plan",
  metrics_summary: null,
  started_at: null,
  completed_at: null,
  notes: "Not started.",
  dataset: {
    id: "DS-0005",
    title: "CIC-Trap4Phish 2025",
    status: "not_downloaded",
    summary: null,
  },
  dataset_version_label: "registry",
  experiment_profile: null,
  derivation_fingerprint: null,
  feature_config: null,
  model_settings: null,
  metrics: null,
  confusion_matrix: null,
  model_sha256: null,
  vocabulary_sha256: null,
  manifest_sha256: null,
};

describe("dataset experiment client", () => {
  it("lists experiments with credentials and without a CSRF header", async () => {
    const api = installApiFetch((url) => {
      if (!url.includes("/api/v1/dataset-experiments")) return undefined;
      if (url.includes("/api/v1/dataset-experiments/")) return undefined;
      return jsonResponse({ page: 1, page_size: 100, total: 1, items: [legacy] });
    });

    const page = await fetchDatasetExperiments({ status: "planned", datasetId: "DS-0005" });
    expect(page.items[0]?.id).toBe("RSCH-0004");
    const url = api.calls.find((call) => call.includes("/api/v1/dataset-experiments?")) ?? "";
    expect(url).toContain("status=planned");
    expect(url).toContain("dataset_id=DS-0005");
    const index = api.calls.indexOf(url);
    expect(api.credentialFlags[index]).toBe("include");
    expect(api.inits[index]?.method ?? "GET").toBe("GET");
    expect((api.inits[index]?.headers as Headers).get("X-CSRF-Token")).toBeNull();
  });

  it("loads one experiment and preserves null legacy fields", async () => {
    const api = installApiFetch((url) => {
      if (!url.includes("/api/v1/dataset-experiments/RSCH-0004")) return undefined;
      return jsonResponse(legacy);
    });

    const detail = await fetchDatasetExperiment("RSCH-0004");
    expect(detail.experiment_profile).toBeNull();
    expect(detail.metrics).toBeNull();
    expect(detail.model_settings).toBeNull();
    expect(detail.confusion_matrix).toBeNull();
    expect(detail.model_sha256).toBeNull();
    const index = api.calls.findIndex((call) =>
      call.includes("/api/v1/dataset-experiments/RSCH-0004"),
    );
    expect(api.credentialFlags[index]).toBe("include");
    expect((api.inits[index]?.headers as Headers).get("X-CSRF-Token")).toBeNull();
  });
});
