import { apiGet, apiPatch } from "@/services/api-client";
import type {
  AccountPreferencesResponse,
  AccountPreferencesUpdate,
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

export function updateAccountPreferences(patch: AccountPreferencesUpdate) {
  return apiPatch<AccountPreferencesResponse>("/api/v1/account/preferences", patch);
}

export function fetchAccountWorkspace() {
  return apiGet<AccountWorkspaceResponse>("/api/v1/account/workspace");
}
