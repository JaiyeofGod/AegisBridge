import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { apiMutate, clearCsrfToken, getCsrfToken, setCsrfToken } from "@/services/api-client";
import { logoutAllSessions, logoutCurrentSession } from "@/services/auth";
import { installApiFetch, jsonResponse } from "@/test/api-fixtures";

function csrfHeader(init: RequestInit | undefined): string | null {
  if (!init?.headers) return null;
  if (init.headers instanceof Headers) {
    return init.headers.get("X-CSRF-Token");
  }
  return null;
}

describe("CSRF client", () => {
  beforeEach(() => {
    clearCsrfToken();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    clearCsrfToken();
  });

  it("attaches credentials and X-CSRF-Token on mutations", async () => {
    setCsrfToken("memory-csrf");
    const { credentialFlags, inits } = installApiFetch(undefined, { authenticated: true });

    await apiMutate("PATCH", "/api/v1/account/preferences", { theme: "dark" });

    const patchInit = inits.find((init) => init?.method === "PATCH");
    expect(credentialFlags.every((flag) => flag === "include")).toBe(true);
    expect(patchInit?.credentials).toBe("include");
    expect(csrfHeader(patchInit)).toBe("memory-csrf");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(getCsrfToken()).toBe("memory-csrf");
  });

  it("never stores CSRF tokens in localStorage or sessionStorage", async () => {
    setCsrfToken("secret-csrf");
    installApiFetch(undefined, { authenticated: true });
    await apiMutate("POST", "/api/v1/auth/logout");
    expect(localStorage.getItem("csrf")).toBeNull();
    expect(sessionStorage.getItem("csrf")).toBeNull();
    expect(JSON.stringify({ ...localStorage })).not.toContain("secret-csrf");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("secret-csrf");
  });

  it("sends CSRF on logout and logout-all", async () => {
    setCsrfToken("logout-csrf");
    const first = installApiFetch(undefined, { authenticated: true });
    await logoutCurrentSession();
    const logoutInit = first.inits.find(
      (init, index) => init?.method === "POST" && first.calls[index]?.includes("/auth/logout"),
    );
    expect(csrfHeader(logoutInit)).toBe("logout-csrf");
    expect(getCsrfToken()).toBeNull();

    setCsrfToken("logout-all-csrf");
    const second = installApiFetch(undefined, { authenticated: true });
    await logoutAllSessions();
    const logoutAllInit = second.inits.find(
      (init, index) => init?.method === "POST" && second.calls[index]?.includes("/auth/logout-all"),
    );
    expect(csrfHeader(logoutAllInit)).toBe("logout-all-csrf");
  });

  it("refreshes CSRF once on csrf_failed without infinite retry", async () => {
    clearCsrfToken();
    let csrfGets = 0;
    let patches = 0;
    installApiFetch(
      (url, init) => {
        if (url.includes("/api/v1/auth/csrf")) {
          csrfGets += 1;
          return jsonResponse({ csrf_token: `fresh-${csrfGets}`, header_name: "X-CSRF-Token" });
        }
        if (url.includes("/api/v1/account/preferences") && init?.method === "PATCH") {
          patches += 1;
          if (patches === 1) {
            return jsonResponse({ code: "csrf_failed", message: "CSRF validation failed." }, 403);
          }
          return jsonResponse({
            persistence: "stored",
            theme: "dark",
            density: "comfortable",
            landing_page: "overview",
            reduced_motion: false,
            semantics: "stored",
            updated_at: "2026-10-21T15:00:00+00:00",
          });
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );

    const result = await apiMutate("PATCH", "/api/v1/account/preferences", { theme: "dark" });
    expect(result).toMatchObject({ persistence: "stored", theme: "dark" });
    expect(csrfGets).toBeGreaterThanOrEqual(1);
    expect(patches).toBe(2);
    expect(getCsrfToken()).toMatch(/^fresh-/);
  });

  it("does not retry csrf_failed forever", async () => {
    clearCsrfToken();
    let patches = 0;
    installApiFetch(
      (url, init) => {
        if (url.includes("/api/v1/auth/csrf")) {
          return jsonResponse({ csrf_token: "always-stale", header: "X-CSRF-Token" });
        }
        if (url.includes("/api/v1/account/preferences") && init?.method === "PATCH") {
          patches += 1;
          return jsonResponse({ code: "csrf_failed", message: "CSRF validation failed." }, 403);
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );

    await expect(
      apiMutate("PATCH", "/api/v1/account/preferences", { theme: "dark" }),
    ).rejects.toMatchObject({ code: "csrf_failed", status: 403 });
    expect(patches).toBe(2);
  });
});
