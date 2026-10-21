"""add CSRF digest on sessions and user_preferences

Revision ID: 20261020_0007
Revises: 20261020_0006
Create Date: 2026-10-20 26:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0007"
down_revision: str | Sequence[str] | None = "20261020_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("csrf_token_digest", sa.String(length=64), nullable=True),
    )
    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("theme", sa.String(length=16), nullable=False),
        sa.Column("density", sa.String(length=16), nullable=False),
        sa.Column("landing_page", sa.String(length=32), nullable=False),
        sa.Column("reduced_motion", sa.Boolean(), nullable=False),
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "theme IN ('system', 'dark', 'light')",
            name=op.f("ck_user_preferences_theme"),
        ),
        sa.CheckConstraint(
            "density IN ('comfortable', 'compact')",
            name=op.f("ck_user_preferences_density"),
        ),
        sa.CheckConstraint(
            "landing_page IN ('overview')",
            name=op.f("ck_user_preferences_landing_page"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_user_preferences_user_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_preferences")),
        sa.UniqueConstraint("user_id", name=op.f("uq_user_preferences_user_id")),
    )
    op.create_index(
        op.f("ix_user_preferences_user_id"), "user_preferences", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_preferences_user_id"), table_name="user_preferences")
    op.drop_table("user_preferences")
    op.drop_column("sessions", "csrf_token_digest")
