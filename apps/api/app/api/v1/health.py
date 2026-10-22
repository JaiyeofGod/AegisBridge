"""Health endpoints for liveness and readiness probes."""

from fastapi import APIRouter, Response, status

from app.core.config import get_settings
from app.core.db import check_database_ready
from app.core.redis_check import check_redis_ready
from app.schemas.health import (
    AggregateHealthResponse,
    ComponentStatus,
    LiveHealthResponse,
    ReadyHealthResponse,
)
from app.storage.factory import check_object_storage_ready

router = APIRouter(prefix="/health", tags=["health"])


def _run_readiness_checks() -> list[ComponentStatus]:
    database_ok = check_database_ready()
    redis_ok = check_redis_ready()
    object_storage_ok = check_object_storage_ready()
    return [
        ComponentStatus(
            name="postgresql",
            status="ok" if database_ok else "unavailable",
            required=True,
        ),
        ComponentStatus(
            name="redis",
            status="ok" if redis_ok else "unavailable",
            required=False,
        ),
        ComponentStatus(
            name="object_storage",
            status="ok" if object_storage_ok else "unavailable",
            required=False,
        ),
    ]


def _required_checks_ok(checks: list[ComponentStatus]) -> bool:
    return all(check.status == "ok" for check in checks if check.required)


@router.get("", response_model=AggregateHealthResponse)
def health_summary(response: Response) -> AggregateHealthResponse:
    checks = _run_readiness_checks()
    ready = "ready" if _required_checks_ok(checks) else "not_ready"
    if ready == "ready":
        response.status_code = status.HTTP_200_OK
        return AggregateHealthResponse(
            status="ok",
            live="ok",
            ready=ready,
            checks=checks,
        )

    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return AggregateHealthResponse(
        status="unavailable",
        live="ok",
        ready=ready,
        checks=checks,
    )


@router.get("/live", response_model=LiveHealthResponse)
def health_live() -> LiveHealthResponse:
    settings = get_settings()
    return LiveHealthResponse(status="ok", service=settings.app_name)


@router.get("/ready", response_model=ReadyHealthResponse)
def health_ready(response: Response) -> ReadyHealthResponse:
    checks = _run_readiness_checks()
    if _required_checks_ok(checks):
        response.status_code = status.HTTP_200_OK
        return ReadyHealthResponse(status="ready", checks=checks)

    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadyHealthResponse(status="not_ready", checks=checks)
