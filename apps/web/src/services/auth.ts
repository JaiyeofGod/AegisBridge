import { apiGet, apiPost, apiPostCsrf, clearCsrfToken, setCsrfToken } from "@/services/api-client";
import type { CurrentUser, LoginResponse, SessionStatus } from "@/services/api-types";

export function fetchAuthSession() {
  return apiGet<SessionStatus>("/api/v1/auth/session");
}

export function fetchCurrentUser() {
  return apiGet<CurrentUser>("/api/v1/auth/me");
}

export async function loginWithPassword(email: string, password: string): Promise<LoginResponse> {
  const response = await apiPost<LoginResponse>("/api/v1/auth/login", { email, password });
  if (typeof response.csrf_token === "string" && response.csrf_token.length > 0) {
    setCsrfToken(response.csrf_token);
  }
  return response;
}

export async function logoutCurrentSession() {
  try {
    return await apiPostCsrf<SessionStatus>("/api/v1/auth/logout");
  } finally {
    clearCsrfToken();
  }
}

export async function logoutAllSessions() {
  try {
    return await apiPostCsrf<SessionStatus>("/api/v1/auth/logout-all");
  } finally {
    clearCsrfToken();
  }
}
