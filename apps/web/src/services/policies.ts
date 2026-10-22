import { apiGet, apiPatch, apiPostCsrf } from "@/services/api-client";
import type {
  PageResponse,
  PolicyAcknowledgeResult,
  PolicyCreate,
  PolicyDetail,
  PolicyListItem,
  PolicyTransition,
  PolicyUpdate,
  PolicyVersionCreate,
  PolicyVersionDetail,
  PolicyVersionSummary,
  PolicyVersionUpdate,
} from "@/services/api-types";

export function fetchPolicies(page = 1, pageSize = 50) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  return apiGet<PageResponse<PolicyListItem>>(`/api/v1/policies?${params}`);
}

export function fetchPolicy(policyId: string) {
  return apiGet<PolicyDetail>(`/api/v1/policies/${encodeURIComponent(policyId)}`);
}

export function fetchPolicyVersions(policyId: string) {
  return apiGet<PolicyVersionSummary[]>(
    `/api/v1/policies/${encodeURIComponent(policyId)}/versions`,
  );
}

export function fetchPolicyVersion(policyId: string, versionLabel: string) {
  return apiGet<PolicyVersionDetail>(
    `/api/v1/policies/${encodeURIComponent(policyId)}/versions/${encodeURIComponent(versionLabel)}`,
  );
}

export function createPolicy(body: PolicyCreate) {
  return apiPostCsrf<PolicyDetail>("/api/v1/policies", body);
}

export function updatePolicy(policyId: string, body: PolicyUpdate) {
  return apiPatch<PolicyDetail>(`/api/v1/policies/${encodeURIComponent(policyId)}`, body);
}

export function createPolicyVersion(policyId: string, body: PolicyVersionCreate) {
  return apiPostCsrf<PolicyVersionDetail>(
    `/api/v1/policies/${encodeURIComponent(policyId)}/versions`,
    body,
  );
}

export function updatePolicyVersion(
  policyId: string,
  versionLabel: string,
  body: PolicyVersionUpdate,
) {
  return apiPatch<PolicyVersionDetail>(
    `/api/v1/policies/${encodeURIComponent(policyId)}/versions/${encodeURIComponent(versionLabel)}`,
    body,
  );
}

export function transitionPolicy(policyId: string, body: PolicyTransition) {
  return apiPostCsrf<PolicyDetail>(
    `/api/v1/policies/${encodeURIComponent(policyId)}/transition`,
    body,
  );
}

export function acknowledgePolicy(policyId: string) {
  return apiPostCsrf<PolicyAcknowledgeResult>(
    `/api/v1/policies/${encodeURIComponent(policyId)}/acknowledge`,
  );
}
