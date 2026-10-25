"""Response headers and proxy trust. Local processes do not emit HSTS."""

from __future__ import annotations

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.config import Settings
from app.core.production import is_production

# First public deployment. No includeSubDomains and no preload.
HSTS_VALUE = "max-age=15552000"
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
REFERRER_POLICY = "no-referrer"
PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=()"


def apply_security_headers(response: Response, *, request: Request, settings: Settings) -> None:
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", REFERRER_POLICY)
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Content-Security-Policy", API_CSP)
    response.headers.setdefault("Permissions-Policy", PERMISSIONS_POLICY)
    if is_production(settings) and request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", HSTS_VALUE)
    path = request.url.path
    if path.startswith("/api/v1/auth") or path.startswith("/api/v1/account"):
        response.headers["Cache-Control"] = "no-store"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: object, settings: Settings) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self.settings = settings

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        apply_security_headers(response, request=request, settings=self.settings)
        return response
