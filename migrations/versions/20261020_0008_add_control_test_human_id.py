"""add public human_id to control_tests

Revision ID: 20261020_0008
Revises: 20261020_0007
Create Date: 2026-10-22 01:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0008"
down_revision: str | Sequence[str] | None = "20261020_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "control_tests",
        sa.Column("human_id", sa.String(length=32), nullable=True),
    )
    # Table is empty in seed environments; assign deterministic ids if any rows exist.
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id FROM control_tests ORDER BY created_at, id")).fetchall()
    for index, row in enumerate(rows, start=1):
        connection.execute(
            sa.text("UPDATE control_tests SET human_id = :hid WHERE id = :id"),
            {"hid": f"CTEST-{index:04d}", "id": row[0]},
        )
    op.alter_column("control_tests", "human_id", existing_type=sa.String(length=32), nullable=False)
    op.create_unique_constraint(
        op.f("uq_control_tests_human_id"),
        "control_tests",
        ["human_id"],
    )


def downgrade() -> None:
    op.drop_constraint(op.f("uq_control_tests_human_id"), "control_tests", type_="unique")
    op.drop_column("control_tests", "human_id")
