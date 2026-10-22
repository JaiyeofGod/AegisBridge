import {
  apiDelete,
  apiGet,
  apiGetBlob,
  apiPatch,
  apiPostCsrf,
  apiPostMultipart,
} from "@/services/api-client";
import type {
  ControlDetail,
  ControlEvidenceLinkResult,
  ControlImplementationUpdate,
  ControlListItem,
  ControlListQuery,
  ControlTestCreate,
  ControlTestItem,
  ControlTestUpdate,
  EvidenceCreate,
  EvidenceDetail,
  EvidenceObjectDeleteResult,
  GovernanceSummary,
  PageResponse,
} from "@/services/api-types";

export function fetchGovernanceSummary() {
  return apiGet<GovernanceSummary>("/api/v1/governance/summary");
}

export function fetchGovernanceControls(query: ControlListQuery = {}) {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 25));
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.framework?.trim()) params.set("framework", query.framework.trim());
  if (query.implementationStatus) {
    params.set("implementation_status", query.implementationStatus);
  }
  if (query.sort) params.set("sort", query.sort);
  if (query.direction) params.set("direction", query.direction);
  return apiGet<PageResponse<ControlListItem>>(`/api/v1/governance/controls?${params}`);
}

export function fetchGovernanceControl(controlId: string) {
  return apiGet<ControlDetail>(`/api/v1/governance/controls/${encodeURIComponent(controlId)}`);
}

export function updateControlImplementation(controlId: string, body: ControlImplementationUpdate) {
  return apiPatch<ControlDetail>(
    `/api/v1/governance/controls/${encodeURIComponent(controlId)}/implementation`,
    body,
  );
}

export function createControlTest(controlId: string, body: ControlTestCreate) {
  return apiPostCsrf<ControlTestItem>(
    `/api/v1/governance/controls/${encodeURIComponent(controlId)}/tests`,
    body,
  );
}

export function updateControlTest(testId: string, body: ControlTestUpdate) {
  return apiPatch<ControlTestItem>(
    `/api/v1/governance/control-tests/${encodeURIComponent(testId)}`,
    body,
  );
}

export function fetchEvidence(evidenceId: string) {
  return apiGet<EvidenceDetail>(`/api/v1/evidence/${encodeURIComponent(evidenceId)}`);
}

export function createEvidence(body: EvidenceCreate) {
  return apiPostCsrf<EvidenceDetail>("/api/v1/evidence", body);
}

export function linkControlEvidence(controlId: string, evidenceId: string) {
  return apiPostCsrf<ControlEvidenceLinkResult>(
    `/api/v1/governance/controls/${encodeURIComponent(controlId)}/evidence/${encodeURIComponent(evidenceId)}`,
  );
}

export function unlinkControlEvidence(controlId: string, evidenceId: string) {
  return apiDelete<ControlEvidenceLinkResult>(
    `/api/v1/governance/controls/${encodeURIComponent(controlId)}/evidence/${encodeURIComponent(evidenceId)}`,
  );
}

export function uploadEvidenceObject(evidenceId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return apiPostMultipart<EvidenceDetail>(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}/object`,
    formData,
  );
}

export function deleteEvidenceObject(evidenceId: string) {
  return apiDelete<EvidenceObjectDeleteResult>(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}/object`,
  );
}

export async function downloadEvidenceObject(evidenceId: string): Promise<void> {
  const { blob, filename } = await apiGetBlob(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}/object`,
  );
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename || `${evidenceId}.bin`;
    anchor.rel = "noopener";
    // Prevent jsdom from attempting real navigation on click.
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
    });
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
