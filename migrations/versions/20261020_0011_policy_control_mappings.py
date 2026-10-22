"""Add policy_control_mappings relationship table.

Revision ID: 20261020_0011
Revises: 20261020_0010
Create Date: 2026-10-22 06:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0011"
down_revision: str | Sequence[str] | None = "20261020_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "policy_control_mappings",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("policy_id", sa.Uuid(), nullable=False),
        sa.Column("control_id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["control_id"], ["controls.id"]),
        sa.ForeignKeyConstraint(["policy_id"], ["policies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("policy_id", "control_id", name="policy_control"),
    )
    op.create_index(
        op.f("ix_policy_control_mappings_control_id"),
        "policy_control_mappings",
        ["control_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_policy_control_mappings_policy_id"),
        "policy_control_mappings",
        ["policy_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_policy_control_mappings_policy_id"), table_name="policy_control_mappings"
    )
    op.drop_index(
        op.f("ix_policy_control_mappings_control_id"), table_name="policy_control_mappings"
    )
    op.drop_table("policy_control_mappings")
