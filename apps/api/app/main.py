"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from starlette.middleware.trustedhost import TrustedHostMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app import __version__
from app.api.errors import register_exception_handlers
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.http_security import SecurityHeadersMiddleware
from app.core.production import is_production, require_production

# Paths that remain callable without a session cookie.
_PUBLIC_API_PATHS = frozenset(
    {
        "/api/v1/health",
        "/api/v1/health/live",
        "/api/v1/health/ready",
        "/api/v1/auth/login",
        "/api/v1/auth/session",
    }
)


def create_app() -> FastAPI:
    settings = get_settings()
    if is_production(settings):
        require_production(settings)
    origins = settings.cors_origin_list()
    if "*" in origins:
        raise RuntimeError("CORS_ORIGINS must not use wildcard when credentials are enabled.")
    production = is_production(settings)
    application = FastAPI(
        title="AegisBridge API",
        version=__version__,
        docs_url=None if production else "/docs",
        redoc_url=None if production else "/redoc",
    )
    # First added is innermost. Proxy headers run first so later checks see https.
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Accept", "Content-Type", "X-CSRF-Token"],
    )
    hosts = settings.trusted_host_list()
    if hosts:
        application.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts, www_redirect=False)
    application.add_middleware(SecurityHeadersMiddleware, settings=settings)
    forwarded = settings.forwarded_allow_ips.strip()
    if forwarded:
        application.add_middleware(ProxyHeadersMiddleware, trusted_hosts=forwarded)
    register_exception_handlers(application)
    application.include_router(api_router)

    def custom_openapi() -> dict:
        if application.openapi_schema:
            return application.openapi_schema
        schema = get_openapi(
            title=application.title,
            version=application.version,
            routes=application.routes,
        )
        components = schema.setdefault("components", {})
        schemes = components.setdefault("securitySchemes", {})
        schemes["SessionCookie"] = {
            "type": "apiKey",
            "in": "cookie",
            "name": settings.session_cookie_name,
            "description": "HttpOnly session cookie issued by POST /api/v1/auth/login.",
        }
        for path, methods in schema.get("paths", {}).items():
            if path in _PUBLIC_API_PATHS:
                continue
            if not path.startswith("/api/v1/"):
                continue
            for method, operation in methods.items():
                if method in {"get", "post", "put", "patch", "delete"} and isinstance(
                    operation, dict
                ):
                    operation.setdefault("security", [{"SessionCookie": []}])
        application.openapi_schema = schema
        return schema

    application.openapi = custom_openapi  # type: ignore[method-assign]
    return application


app = create_app()
