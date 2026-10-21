/**
 * In-memory synchronizer CSRF token. Never persisted to localStorage/sessionStorage.
 * Distinct from the HttpOnly session cookie (which JavaScript never reads).
 */

const DEFAULT_HEADER = "X-CSRF-Token";

let csrfToken: string | null = null;
let csrfHeaderName = DEFAULT_HEADER;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function getCsrfHeaderName(): string {
  return csrfHeaderName;
}

export function setCsrfToken(token: string | null, headerName = DEFAULT_HEADER): void {
  csrfToken = token && token.trim().length > 0 ? token : null;
  csrfHeaderName = headerName.trim() || DEFAULT_HEADER;
}

export function clearCsrfToken(): void {
  csrfToken = null;
  csrfHeaderName = DEFAULT_HEADER;
}
