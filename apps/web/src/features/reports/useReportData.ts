import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { DatasetQuery, ExperimentQuery, ReportDefinitionQuery } from "@/services/api-types";
import {
  fetchDataset,
  fetchDatasetExperiment,
  fetchDatasetExperiments,
  fetchDatasets,
} from "@/services/datasets";
import {
  fetchReportDefinition,
  fetchReportDefinitions,
  fetchReportsSummary,
} from "@/services/reports";

const definitionsKey = ["reports", "definitions"] as const;
const datasetsKey = ["reports", "datasets"] as const;
const experimentsKey = ["reports", "experiments"] as const;

export function useReportsSummary() {
  return useQuery({
    queryKey: ["reports", "summary"],
    queryFn: fetchReportsSummary,
    retry: false,
    staleTime: 30_000,
  });
}

export function useReportDefinitionCatalog() {
  return useQuery({
    queryKey: [...definitionsKey, "catalog"],
    queryFn: () => fetchReportDefinitions({ pageSize: 100 }),
    retry: false,
    staleTime: 30_000,
  });
}

export function useReportDefinitionList(query: ReportDefinitionQuery, enabled: boolean) {
  return useQuery({
    queryKey: [...definitionsKey, query],
    queryFn: () => fetchReportDefinitions({ ...query, pageSize: 100 }),
    enabled,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useReportDefinitionDetail(reportId: string) {
  return useQuery({
    queryKey: [...definitionsKey, "detail", reportId],
    queryFn: () => fetchReportDefinition(reportId),
    enabled: reportId.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}

export function useDatasetCatalog() {
  return useQuery({
    queryKey: [...datasetsKey, "catalog"],
    queryFn: () => fetchDatasets({ pageSize: 100 }),
    retry: false,
    staleTime: 30_000,
  });
}

export function useDatasetList(query: DatasetQuery, enabled: boolean) {
  return useQuery({
    queryKey: [...datasetsKey, query],
    queryFn: () => fetchDatasets({ ...query, pageSize: 100 }),
    enabled,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useDatasetDetail(datasetId: string) {
  return useQuery({
    queryKey: [...datasetsKey, "detail", datasetId],
    queryFn: () => fetchDataset(datasetId),
    enabled: datasetId.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}

export function useExperimentCatalog() {
  return useQuery({
    queryKey: [...experimentsKey, "catalog"],
    queryFn: () => fetchDatasetExperiments({ pageSize: 100 }),
    retry: false,
    staleTime: 30_000,
  });
}

export function useExperimentList(query: ExperimentQuery, enabled: boolean) {
  return useQuery({
    queryKey: [...experimentsKey, query],
    queryFn: () => fetchDatasetExperiments({ ...query, pageSize: 100 }),
    enabled,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useExperimentDetail(experimentId: string) {
  return useQuery({
    queryKey: [...experimentsKey, "detail", experimentId],
    queryFn: () => fetchDatasetExperiment(experimentId),
    enabled: experimentId.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}
