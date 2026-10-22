"""Add policy version lifecycle status and change_summary; constrain policy status.

Revision ID: 20261020_0010
Revises: 20261020_0009
Create Date: 2026-10-22 05:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0010"
down_revision: str | Sequence[str] | None = "20261020_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "policy_versions",
        sa.Column(
            "status",
            sa.String(length=32),
            server_default="draft",
            nullable=False,
        ),
    )
    op.add_column(
        "policy_versions",
        sa.Column("change_summary", sa.Text(), nullable=True),
    )
    op.execute(
        sa.text(
            """
            UPDATE policy_versions
            SET status = CASE
                WHEN is_current THEN 'published'
                ELSE 'draft'
            END
            """
        )
    )
    op.create_check_constraint(
        "policy_version_status",
        "policy_versions",
        "status IN ('draft', 'published', 'superseded')",
    )
    op.create_check_constraint(
        "policy_status",
        "policies",
        "status IN ('draft', 'in_review', 'approved', 'published', 'retired')",
    )


def downgrade() -> None:
    # Short names; Alembic naming convention expands to ck_<table>_<name>.
    op.drop_constraint("policy_status", "policies", type_="check")
    op.drop_constraint("policy_version_status", "policy_versions", type_="check")
    op.drop_column("policy_versions", "change_summary")
    op.drop_column("policy_versions", "status")
