"""Health check response schemas."""

from typing import Literal

from pydantic import BaseModel, Field


class LiveHealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = Field(description="Logical service name")


class ComponentStatus(BaseModel):
    name: str
    status: Literal["ok", "unavailable"]
    required: bool = True


class ReadyHealthResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    checks: list[ComponentStatus]


class AggregateHealthResponse(BaseModel):
    status: Literal["ok", "degraded", "unavailable"]
    live: Literal["ok"]
    ready: Literal["ready", "not_ready"]
    checks: list[ComponentStatus]
