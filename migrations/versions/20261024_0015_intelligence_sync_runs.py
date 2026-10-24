"""Add intelligence synchronization run records.

Revision ID: 20261024_0015
Revises: 20261024_0014
Create Date: 2026-10-24 02:40:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261024_0015"
down_revision: str | Sequence[str] | None = "20261024_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "intelligence_sync_runs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
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
        sa.Column("sync_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tracked_cve_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("nvd_updated_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("kev_updated_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("epss_updated_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("failed_source_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=True),
        sa.CheckConstraint(
            "status IN ('running', 'completed', 'partial', 'failed')",
            name="ck_intelligence_sync_runs_status",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_intelligence_sync_runs"),
    )


def downgrade() -> None:
    op.drop_table("intelligence_sync_runs")
