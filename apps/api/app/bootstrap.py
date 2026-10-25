"""Create the first production administrator from server environment variables.

This is a one-shot command. It is not an HTTP route and it does not read
AEGIS_DEV_ADMIN_PASSWORD. The password is never printed.

    BOOTSTRAP_ADMIN_EMAIL=operator@example.com \\
    BOOTSTRAP_ADMIN_PASSWORD='(set in the server environment)' \\
    python -m app.bootstrap
"""

from __future__ import annotations

import os

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.auth import UserCredential
from app.models.identity import AccessEntitlement, Permission, Role, User, UserRole
from app.models.organization import Department, Organization
from app.security.passwords import hash_password
from app.security.permissions import PERMISSION_CATALOG, ROLE_PERMISSIONS
from app.services.auth import normalize_email

_WEAK_PASSWORDS = frozenset({"password", "changeme", "aegisbridge", "administrator"})
_ROLE_SUMMARY = "Created by the production bootstrap command."


class BootstrapError(RuntimeError):
    """The command stopped before writing a credential."""


def validate_bootstrap_password(password: str, email: str) -> None:
    if len(password) < 12 or len(password) > 1024:
        raise BootstrapError("BOOTSTRAP_ADMIN_PASSWORD must be 12 to 1024 characters.")
    lowered = password.casefold()
    if lowered in _WEAK_PASSWORDS or lowered == email.casefold():
        raise BootstrapError("BOOTSTRAP_ADMIN_PASSWORD is too easy to guess.")


def bootstrap_administrator(
    session: Session,
    *,
    email: str,
    password: str,
    display_name: str,
) -> str:
    """Create an empty organization or set a missing password. Caller commits."""
    normalized = normalize_email(email)
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise BootstrapError("BOOTSTRAP_ADMIN_EMAIL must be an email address.")
    validate_bootstrap_password(password, normalized)
    existing = session.scalar(select(User).where(func.lower(User.email) == normalized))
    if existing is None:
        user_count = session.scalar(select(func.count()).select_from(User)) or 0
        if user_count:
            raise BootstrapError(
                "This database already has users. Bootstrap will not add another organization."
            )
        _create_organization(
            session,
            email=normalized,
            password=password,
            display_name=display_name,
        )
        return "created"
    credential_query = select(UserCredential).where(UserCredential.user_id == existing.id)
    credential = session.scalar(credential_query)
    if credential is not None:
        raise BootstrapError("That account already has a password. Bootstrap will not replace it.")
    session.add(
        UserCredential(
            user_id=existing.id,
            password_hash=hash_password(password),
            algorithm="argon2id",
        )
    )
    return "password_set"


def _create_organization(
    session: Session,
    *,
    email: str,
    password: str,
    display_name: str,
) -> None:
    organization = Organization(
        name="AegisBridge",
        slug="aegisbridge",
        environment_label="Production",
        data_origin="operator",
    )
    session.add(organization)
    session.flush()
    department = Department(organization_id=organization.id, name="Security")
    session.add(department)
    permissions = {
        code: Permission(code=code, description=description)
        for code, description in PERMISSION_CATALOG.items()
    }
    session.add_all(permissions.values())
    session.flush()
    roles: dict[str, Role] = {}
    for name in ROLE_PERMISSIONS:
        role = Role(organization_id=organization.id, name=name, summary=_ROLE_SUMMARY)
        roles[name] = role
        session.add(role)
    session.flush()
    user = User(
        organization_id=organization.id,
        department_id=department.id,
        human_id="USR-0001",
        email=email,
        display_name=display_name,
        job_title="Administrator",
        account_status="active",
        timezone_name="UTC",
    )
    session.add(user)
    session.flush()
    session.add(UserRole(user_id=user.id, role_id=roles["Administrator"].id))
    for code in ROLE_PERMISSIONS["Administrator"]:
        session.add(
            AccessEntitlement(
                user_id=user.id,
                permission_id=permissions[code].id,
                grant_source="bootstrap",
            )
        )
    session.add(
        UserCredential(
            user_id=user.id,
            password_hash=hash_password(password),
            algorithm="argon2id",
        )
    )


def main() -> None:
    email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "").strip()
    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "")
    display_name = os.environ.get("BOOTSTRAP_ADMIN_DISPLAY_NAME", "").strip() or "Administrator"
    if not email or not password:
        raise SystemExit(
            "Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in the server environment."
        )
    try:
        with SessionLocal() as session:
            outcome = bootstrap_administrator(
                session,
                email=email,
                password=password,
                display_name=display_name,
            )
            session.commit()
    except BootstrapError as exc:
        raise SystemExit(str(exc)) from None
    print(f"Bootstrap {outcome}. Password was not printed.")


if __name__ == "__main__":
    main()
