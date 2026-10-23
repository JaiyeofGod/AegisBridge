"""Restore the developer Administrator credential after tests that reseed it."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth import UserCredential
from app.models.identity import User


@dataclass(frozen=True)
class DevAdminCredentialSnapshot:
    user_present: bool
    password_hash: str | None
    algorithm: str | None


def snapshot_dev_admin_credential(session: Session) -> DevAdminCredentialSnapshot:
    admin = session.scalar(select(User).where(User.human_id == "USR-0001"))
    if admin is None:
        return DevAdminCredentialSnapshot(False, None, None)
    credential = session.scalar(select(UserCredential).where(UserCredential.user_id == admin.id))
    if credential is None:
        return DevAdminCredentialSnapshot(True, None, None)
    return DevAdminCredentialSnapshot(True, credential.password_hash, credential.algorithm)


def restore_dev_admin_credential(session: Session, snapshot: DevAdminCredentialSnapshot) -> None:
    """Put USR-0001's credential back. No-op when that user did not exist beforehand."""
    if not snapshot.user_present:
        return
    admin = session.scalar(select(User).where(User.human_id == "USR-0001"))
    if admin is None:
        return
    credential = session.scalar(select(UserCredential).where(UserCredential.user_id == admin.id))
    if snapshot.password_hash is None:
        if credential is not None:
            session.delete(credential)
    elif credential is None:
        session.add(
            UserCredential(
                user_id=admin.id,
                password_hash=snapshot.password_hash,
                algorithm=snapshot.algorithm or "argon2id",
            )
        )
    else:
        credential.password_hash = snapshot.password_hash
        credential.algorithm = snapshot.algorithm or "argon2id"
    session.commit()
