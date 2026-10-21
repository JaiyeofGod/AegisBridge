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
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
