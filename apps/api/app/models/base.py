"""Shared SQLAlchemy base, keys, and timestamps."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, MetaData, String, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDMixin:
    """Internal primary key. PostgreSQL assigns the value when the ORM omits it."""

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))


class TimestampMixin:
    """Insert time is a database default. Updates are applied by the ORM."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        onupdate=text("now()"),
        nullable=False,
    )


def human_id_column() -> Mapped[str]:
    return mapped_column(String(32), nullable=False, unique=True)
