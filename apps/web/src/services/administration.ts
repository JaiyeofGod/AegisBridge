import { apiGet } from "@/services/api-client";
import type {
  AccessReviewListItem,
  AdministrationSummary,
  AdminRoleListItem,
  AdminUserListItem,
  AuditEventListItem,
  IntegrationListItem,
  PageResponse,
} from "@/services/api-types";

const page = "page=1&page_size=100";

export function fetchAdministrationSummary() {
  return apiGet<AdministrationSummary>("/api/v1/administration/summary");
}

export function fetchIntegrations() {
  return apiGet<PageResponse<IntegrationListItem>>(`/api/v1/administration/integrations?${page}`);
}

export function fetchUsers() {
  return apiGet<PageResponse<AdminUserListItem>>(`/api/v1/administration/users?${page}`);
}

export function fetchRoles() {
  return apiGet<PageResponse<AdminRoleListItem>>(`/api/v1/administration/roles?${page}`);
}

export function fetchAuditEvents() {
  return apiGet<PageResponse<AuditEventListItem>>(`/api/v1/administration/audit-events?${page}`);
}

export function fetchAccessReviews() {
  return apiGet<PageResponse<AccessReviewListItem>>(
    `/api/v1/administration/access-reviews?${page}`,
  );
}
