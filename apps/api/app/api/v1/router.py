"""API v1 root router."""

from fastapi import APIRouter

from app.api.v1 import (
    account,
    administration,
    alerts,
    assets,
    attack,
    auth,
    cyber_range,
    datasets,
    directory,
    evidence,
    experiments,
    governance,
    health,
    incidents,
    overview,
    policies,
    reports,
    risks,
    threat_intel,
    vulnerabilities,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(account.router)
api_router.include_router(overview.router)
api_router.include_router(assets.router)
api_router.include_router(risks.router)
api_router.include_router(vulnerabilities.router)
api_router.include_router(alerts.router)
api_router.include_router(attack.router)
api_router.include_router(incidents.router)
api_router.include_router(governance.router)
api_router.include_router(policies.router)
api_router.include_router(evidence.router)
api_router.include_router(threat_intel.router)
api_router.include_router(administration.router)
api_router.include_router(reports.router)
api_router.include_router(datasets.router)
api_router.include_router(directory.router)
api_router.include_router(experiments.router)
api_router.include_router(cyber_range.router)
