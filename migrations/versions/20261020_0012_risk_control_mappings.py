"""Add risk_control_mappings relationship table.

Revision ID: 20261020_0012
Revises: 20261020_0011
Create Date: 2026-10-22 20:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0012"
down_revision: str | Sequence[str] | None = "20261020_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "risk_control_mappings",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("risk_id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["risk_id"], ["risks.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("risk_id", "control_id", name="risk_control"),
    )
    op.create_index(
        op.f("ix_risk_control_mappings_control_id"),
        "risk_control_mappings",
        ["control_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_risk_control_mappings_risk_id"),
        "risk_control_mappings",
        ["risk_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_risk_control_mappings_risk_id"), table_name="risk_control_mappings")
    op.drop_index(op.f("ix_risk_control_mappings_control_id"), table_name="risk_control_mappings")
    op.drop_table("risk_control_mappings")
