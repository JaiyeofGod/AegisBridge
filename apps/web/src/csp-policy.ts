/**
 * Frontend Content-Security-Policy built from the public API origin.
 * The value contains no credentials. Render blueprint headers are literal, so
 * this string is produced at build time instead of stored in render.yaml.
 */

const FONT_STYLESHEET_ORIGIN = "https://fonts.googleapis.com";
const FONT_FILE_ORIGIN = "https://fonts.gstatic.com";

export function frontendContentSecurityPolicy(apiBaseUrl: string): string {
  const origin = publicHttpsOrigin(apiBaseUrl);
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline' " + FONT_STYLESHEET_ORIGIN,
    "img-src 'self' data: blob:",
    "font-src 'self' data: " + FONT_FILE_ORIGIN,
    "connect-src 'self' " + origin + " " + FONT_STYLESHEET_ORIGIN + " " + FONT_FILE_ORIGIN,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join("; ");
  if (policy.includes("'unsafe-eval'") || /(^|\s)\*(?=\s|;|$)/.test(policy)) {
    throw new Error("The frontend CSP contains a forbidden source.");
  }
  return policy;
}

function publicHttpsOrigin(apiBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new Error("VITE_API_BASE_URL must be an https origin.");
  }
  if (url.username || url.password) {
    throw new Error("VITE_API_BASE_URL must not include credentials.");
  }
  const hostname = url.hostname;
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (url.protocol !== "https:" || local || hostname.includes("*")) {
    throw new Error("VITE_API_BASE_URL must be an https origin without a wildcard.");
  }
  return url.origin;
}
