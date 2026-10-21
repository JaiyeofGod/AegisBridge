"""Authenticated account read contracts. No password or session secrets."""

from datetime import datetime

from pydantic import BaseModel


class AccountProfile(BaseModel):
    id: str
    display_name: str
    email: str
    department: str | None
    account_status: str
    job_title: str | None
    timezone: str
    organization: str
    created_at: datetime
    data_origin: str


class AccountSessionSummary(BaseModel):
    id: str
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    current: bool


class AccountSecurity(BaseModel):
    password_authentication_configured: bool
    active_session_count: int
    current_session: AccountSessionSummary | None
    mfa_status: str
    last_authenticated_at: datetime | None
    semantics: str


class AccountPreferences(BaseModel):
    persistence: str
    theme: str
    density: str
    landing_page: str
    reduced_motion: bool
    semantics: str


class AccountWorkspace(BaseModel):
    organization: str
    department: str | None
    roles: list[str]
    permissions: list[str]
    privileged: bool
    environment_label: str
    data_origin: str
    privileged_roles: list[str]
    semantics: str
