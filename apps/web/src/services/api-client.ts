import { clearCsrfToken, getCsrfHeaderName, getCsrfToken, setCsrfToken } from "@/services/csrf";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ErrorBody = {
  code?: string;
  message?: string;
};

type CsrfResponse = {
  csrf_token: string;
  header_name?: string;
};

async function parseError(response: Response, path: string): Promise<ApiError> {
  let message = `Request failed: ${path}`;
  let code: string | undefined;
  try {
    const body = (await response.json()) as ErrorBody;
    if (typeof body.message === "string" && body.message.trim().length > 0) {
      message = body.message;
    }
    if (typeof body.code === "string") {
      code = body.code;
    }
  } catch {
    // Keep the generic message when the body is not JSON.
  }
  return new ApiError(message, response.status, code);
}

function requestInit(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  return {
    ...init,
    credentials: "include",
    headers,
  };
}

async function parseSuccessBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, requestInit({ method: "GET" }));
  if (!response.ok) {
    throw await parseError(response, path);
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(
    `${API_BASE}${path}`,
    requestInit({
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  if (!response.ok) {
    throw await parseError(response, path);
  }
  return parseSuccessBody<T>(response);
}

export async function ensureCsrfToken(): Promise<string> {
  const existing = getCsrfToken();
  if (existing) return existing;
  return refreshCsrfToken();
}

export async function refreshCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/auth/csrf`, requestInit({ method: "GET" }));
  if (!response.ok) {
    throw await parseError(response, "/api/v1/auth/csrf");
  }
  const body = (await response.json()) as CsrfResponse;
  if (typeof body.csrf_token !== "string" || body.csrf_token.trim().length === 0) {
    throw new ApiError("CSRF token was not returned.", 500, "csrf_missing");
  }
  setCsrfToken(body.csrf_token, body.header_name ?? getCsrfHeaderName());
  return body.csrf_token;
}

/**
 * Authenticated mutation with credentials + synchronizer CSRF header.
 * On csrf_failed, refreshes the token once and retries. No infinite loops.
 */
export async function apiMutate<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  async function send(retried: boolean): Promise<T> {
    const token = await ensureCsrfToken();
    const headers = new Headers({ Accept: "application/json" });
    headers.set(getCsrfHeaderName(), token);
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(
      `${API_BASE}${path}`,
      requestInit({
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    if (response.ok) {
      return parseSuccessBody<T>(response);
    }
    const error = await parseError(response, path);
    if (!retried && error.status === 403 && error.code === "csrf_failed") {
      clearCsrfToken();
      await refreshCsrfToken();
      return send(true);
    }
    throw error;
  }
  return send(false);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiMutate<T>("PATCH", path, body);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiMutate<T>("PUT", path, body);
}

export async function apiPostCsrf<T>(path: string, body?: unknown): Promise<T> {
  return apiMutate<T>("POST", path, body);
}

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return apiMutate<T>("DELETE", path, body);
}

/**
 * Authenticated multipart POST. Does not set Content-Type so the browser can
 * supply the multipart boundary. CSRF refresh/retry matches apiMutate.
 */
export async function apiPostMultipart<T>(path: string, formData: FormData): Promise<T> {
  async function send(retried: boolean): Promise<T> {
    const token = await ensureCsrfToken();
    const headers = new Headers({ Accept: "application/json" });
    headers.set(getCsrfHeaderName(), token);
    const response = await fetch(
      `${API_BASE}${path}`,
      requestInit({
        method: "POST",
        headers,
        body: formData,
      }),
    );
    if (response.ok) {
      return parseSuccessBody<T>(response);
    }
    const error = await parseError(response, path);
    if (!retried && error.status === 403 && error.code === "csrf_failed") {
      clearCsrfToken();
      await refreshCsrfToken();
      return send(true);
    }
    throw error;
  }
  return send(false);
}

/** Authenticated binary GET for private evidence downloads. */
export async function apiGetBlob(path: string): Promise<{ blob: Blob; filename: string | null }> {
  const response = await fetch(
    `${API_BASE}${path}`,
    requestInit({
      method: "GET",
      headers: new Headers({ Accept: "*/*" }),
    }),
  );
  if (!response.ok) {
    throw await parseError(response, path);
  }
  const disposition = response.headers.get("Content-Disposition");
  let filename: string | null = null;
  if (disposition) {
    const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const plainMatch = /filename="([^"]+)"/i.exec(disposition);
    if (utfMatch?.[1]) {
      try {
        filename = decodeURIComponent(utfMatch[1]);
      } catch {
        filename = utfMatch[1];
      }
    } else if (plainMatch?.[1]) {
      filename = plainMatch[1];
    }
  }
  return { blob: await response.blob(), filename };
}

export { clearCsrfToken, getCsrfToken, setCsrfToken };
