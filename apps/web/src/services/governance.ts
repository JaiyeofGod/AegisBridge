import { apiDelete, apiGet, apiPatch, apiPostCsrf } from "@/services/api-client";
import type {
  ControlDetail,
  ControlEvidenceLinkResult,
  ControlImplementationUpdate,
  ControlListItem,
  ControlTestCreate,
  ControlTestItem,
  ControlTestUpdate,
  EvidenceCreate,
  EvidenceDetail,
  GovernanceSummary,
  PageResponse,
} from "@/services/api-types";

export function fetchGovernanceSummary() {
  return apiGet<GovernanceSummary>("/api/v1/governance/summary");
}

export function fetchGovernanceControls(page = 1, pageSize = 50) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
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
