"""Argon2id password hashing. Never log plaintext passwords or hashes in audit detail."""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from argon2.low_level import Type

_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)

# Fixed Argon2id digest used only to equalize login verification work when no
# stored credential exists. It is not a real account password and is not seeded
# as a user credential. Parameters match `_hasher` (m=65536,t=3,p=4).
DUMMY_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$QWVnaXNEdW1teVNhbHQxNg$"
    "dEvvhW+FQvZ2CtqLh86O0koigKWRGiuQv6nabxRV4ZU"
)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError, InvalidHashError:
        return False


def verify_password_or_dummy(password_hash: str | None, password: str) -> bool:
    """Always run Argon2 verification, using the dummy hash when none is stored."""
    return verify_password(password_hash or DUMMY_PASSWORD_HASH, password)


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def is_argon2id_hash(password_hash: str) -> bool:
    return password_hash.startswith("$argon2id$")
