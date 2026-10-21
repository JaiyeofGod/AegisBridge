import { apiGet, apiPost } from "@/services/api-client";
import type { CurrentUser, SessionStatus } from "@/services/api-types";

export function fetchAuthSession() {
  return apiGet<SessionStatus>("/api/v1/auth/session");
}

export function fetchCurrentUser() {
  return apiGet<CurrentUser>("/api/v1/auth/me");
}

export function loginWithPassword(email: string, password: string) {
  return apiPost<CurrentUser>("/api/v1/auth/login", { email, password });
}

export function logoutCurrentSession() {
  return apiPost<SessionStatus>("/api/v1/auth/logout");
}

export function logoutAllSessions() {
  return apiPost<SessionStatus>("/api/v1/auth/logout-all");
}
