"""API v1 root router."""

from fastapi import APIRouter

from app.api.v1 import (
    alerts,
    assets,
    governance,
    health,
    incidents,
    overview,
    risks,
    vulnerabilities,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(overview.router)
api_router.include_router(assets.router)
api_router.include_router(risks.router)
api_router.include_router(vulnerabilities.router)
api_router.include_router(alerts.router)
api_router.include_router(incidents.router)
api_router.include_router(governance.router)
