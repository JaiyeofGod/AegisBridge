"""Authentication and current-user response contracts. No secrets."""

from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class CurrentUser(BaseModel):
    id: str
    display_name: str
    email: str
    status: str
    department: str | None
    roles: list[str]
    permissions: list[str]
    privileged: bool
    organization: str
    environment_label: str
    data_origin: str
    job_title: str | None = None
    timezone: str | None = None


class SessionStatus(BaseModel):
    authenticated: bool
    user: CurrentUser | None = None
    session_id: str | None = None
    expires_at: datetime | None = None
    last_seen_at: datetime | None = None
