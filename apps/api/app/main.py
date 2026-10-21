"""FastAPI application entry point."""

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app import __version__
from app.api.errors import register_exception_handlers
from app.api.v1.router import api_router
from app.core.config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Baseline response headers. CSP belongs to the frontend/deployment layer."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        path = request.url.path
        if path.startswith("/api/v1/auth") or path.startswith("/api/v1/account"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
        return response


def create_app() -> FastAPI:
    settings = get_settings()
    origins = settings.cors_origin_list()
    if "*" in origins:
        raise RuntimeError("CORS_ORIGINS must not use wildcard when credentials are enabled.")
    application = FastAPI(
        title="AegisBridge API",
        version=__version__,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(SecurityHeadersMiddleware)
    register_exception_handlers(application)
    application.include_router(api_router)
    return application


app = create_app()
