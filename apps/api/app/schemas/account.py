"""Authenticated account contracts. No password or session secrets."""

from datetime import datetime
from typing import Literal

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


ThemeValue = Literal["system", "dark", "light"]
DensityValue = Literal["comfortable", "compact"]
LandingPageValue = Literal["overview"]


class AccountPreferences(BaseModel):
    persistence: str
    theme: str
    density: str
    landing_page: str
    reduced_motion: bool
    semantics: str
    updated_at: datetime | None = None


class AccountPreferencesUpdate(BaseModel):
    """Partial preferences patch. Omitted fields are left unchanged."""

    theme: ThemeValue | None = None
    density: DensityValue | None = None
    landing_page: LandingPageValue | None = None
    reduced_motion: bool | None = None


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
