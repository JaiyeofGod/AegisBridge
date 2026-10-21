import { apiGet } from "@/services/api-client";
import type {
  DatasetDetail,
  DatasetListItem,
  DatasetQuery,
  ExperimentDetail,
  ExperimentListItem,
  ExperimentQuery,
  PageResponse,
} from "@/services/api-types";

export function fetchDatasets(query: DatasetQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.domain) params.set("domain", query.domain);
  if (query.verificationStatus) params.set("verification_status", query.verificationStatus);
  if (query.publicationYear !== undefined) {
    params.set("publication_year", String(query.publicationYear));
  }
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<DatasetListItem>>(`/api/v1/datasets?${params.toString()}`);
}

export function fetchDataset(datasetId: string) {
  return apiGet<DatasetDetail>(`/api/v1/datasets/${encodeURIComponent(datasetId)}`);
}

export function fetchDatasetExperiments(query: ExperimentQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.datasetId) params.set("dataset_id", query.datasetId);
  if (query.experimentType) params.set("experiment_type", query.experimentType);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 100));
  return apiGet<PageResponse<ExperimentListItem>>(
    `/api/v1/dataset-experiments?${params.toString()}`,
  );
}

export function fetchDatasetExperiment(experimentId: string) {
  return apiGet<ExperimentDetail>(
    `/api/v1/dataset-experiments/${encodeURIComponent(experimentId)}`,
  );
}
