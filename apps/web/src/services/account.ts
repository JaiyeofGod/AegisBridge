import { apiGet } from "@/services/api-client";
import type {
  AccountPreferencesResponse,
  AccountProfileResponse,
  AccountSecurityResponse,
  AccountWorkspaceResponse,
} from "@/services/api-types";

export function fetchAccountProfile() {
  return apiGet<AccountProfileResponse>("/api/v1/account/profile");
}

export function fetchAccountSecurity() {
  return apiGet<AccountSecurityResponse>("/api/v1/account/security");
}

export function fetchAccountPreferences() {
  return apiGet<AccountPreferencesResponse>("/api/v1/account/preferences");
}

export function fetchAccountWorkspace() {
  return apiGet<AccountWorkspaceResponse>("/api/v1/account/workspace");
}
