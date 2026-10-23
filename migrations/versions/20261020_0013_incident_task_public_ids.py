"""Add public ids and completion time to incident tasks.

Revision ID: 20261020_0013
Revises: 20261020_0012
Create Date: 2026-10-22 21:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0013"
down_revision: str | Sequence[str] | None = "20261020_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TASK_STATUS = "status IN ('open', 'in_progress', 'blocked', 'completed', 'cancelled')"


def upgrade() -> None:
    op.add_column("incident_tasks", sa.Column("human_id", sa.String(length=32), nullable=True))
    op.add_column(
        "incident_tasks",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT id FROM incident_tasks ORDER BY created_at, id")
    ).fetchall()
    for index, row in enumerate(rows, start=1):
        connection.execute(
            sa.text("UPDATE incident_tasks SET human_id = :human_id WHERE id = :id"),
            {"human_id": f"TASK-{index:04d}", "id": row[0]},
        )
    connection.execute(
        sa.text(
            """
            UPDATE incident_tasks
            SET status = CASE lower(status)
                WHEN 'open' THEN 'open'
                WHEN 'in_progress' THEN 'in_progress'
                WHEN 'blocked' THEN 'blocked'
                WHEN 'completed' THEN 'completed'
                WHEN 'done' THEN 'completed'
                WHEN 'cancelled' THEN 'cancelled'
                WHEN 'canceled' THEN 'cancelled'
                ELSE 'open'
            END
            """
        )
    )
    connection.execute(
        sa.text(
            """
            UPDATE incident_tasks
            SET completed_at = updated_at
            WHERE status = 'completed' AND completed_at IS NULL
            """
        )
    )
    op.alter_column("incident_tasks", "human_id", existing_type=sa.String(length=32), nullable=False)
    op.create_unique_constraint(
        op.f("uq_incident_tasks_human_id"),
        "incident_tasks",
        ["human_id"],
    )
    op.create_check_constraint("task_status", "incident_tasks", _TASK_STATUS)


def downgrade() -> None:
    op.drop_constraint("task_status", "incident_tasks", type_="check")
    op.drop_constraint(op.f("uq_incident_tasks_human_id"), "incident_tasks", type_="unique")
    op.drop_column("incident_tasks", "completed_at")
    op.drop_column("incident_tasks", "human_id")
