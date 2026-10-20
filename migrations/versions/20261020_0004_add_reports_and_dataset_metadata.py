"""add report definitions and dataset registry metadata

Revision ID: 20261020_0004
Revises: 20261020_0003
Create Date: 2026-10-20 23:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0004"
down_revision: str | Sequence[str] | None = "20261020_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "report_definitions",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("human_id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("report_type", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("schedule_state", sa.String(length=32), nullable=False),
        sa.Column("schedule_label", sa.String(length=64), nullable=True),
        sa.Column("format_label", sa.String(length=64), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
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
            "status IN ('draft', 'ready', 'review', 'archived')",
            name=op.f("ck_report_definitions_status"),
        ),
        sa.CheckConstraint(
            "schedule_state IN ('not_scheduled', 'schedule_defined')",
            name=op.f("ck_report_definitions_schedule_state"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_report_definitions_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name=op.f("fk_report_definitions_owner_user_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_report_definitions")),
        sa.UniqueConstraint("human_id", name=op.f("uq_report_definitions_human_id")),
    )
    op.create_index(
        op.f("ix_report_definitions_organization_id"),
        "report_definitions",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_report_definitions_owner_user_id"),
        "report_definitions",
        ["owner_user_id"],
        unique=False,
    )

    op.add_column("datasets", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("datasets", sa.Column("publisher", sa.String(length=200), nullable=True))
    op.add_column("datasets", sa.Column("source_label", sa.String(length=200), nullable=True))
    op.add_column("datasets", sa.Column("source_url", sa.String(length=500), nullable=True))
    op.add_column("datasets", sa.Column("publication_year", sa.Integer(), nullable=True))
    op.add_column("datasets", sa.Column("domain", sa.String(length=200), nullable=True))
    op.add_column("datasets", sa.Column("license_label", sa.String(length=120), nullable=True))
    op.add_column(
        "datasets", sa.Column("verification_status", sa.String(length=64), nullable=True)
    )
    op.add_column("datasets", sa.Column("purpose", sa.Text(), nullable=True))
    op.add_column("datasets", sa.Column("size_label", sa.String(length=120), nullable=True))
    op.add_column("datasets", sa.Column("row_count", sa.BigInteger(), nullable=True))
    op.add_column("datasets", sa.Column("feature_count", sa.Integer(), nullable=True))

    op.add_column(
        "dataset_experiments", sa.Column("human_id", sa.String(length=32), nullable=True)
    )
    op.create_unique_constraint(
        op.f("uq_dataset_experiments_human_id"), "dataset_experiments", ["human_id"]
    )
    op.add_column(
        "dataset_experiments", sa.Column("experiment_type", sa.String(length=80), nullable=True)
    )
    op.add_column(
        "dataset_experiments", sa.Column("approach", sa.String(length=200), nullable=True)
    )
    op.add_column("dataset_experiments", sa.Column("metrics_summary", sa.Text(), nullable=True))
    op.add_column(
        "dataset_experiments",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "dataset_experiments",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("dataset_experiments", "completed_at")
    op.drop_column("dataset_experiments", "started_at")
    op.drop_column("dataset_experiments", "metrics_summary")
    op.drop_column("dataset_experiments", "approach")
    op.drop_column("dataset_experiments", "experiment_type")
    op.drop_constraint(
        op.f("uq_dataset_experiments_human_id"), "dataset_experiments", type_="unique"
    )
    op.drop_column("dataset_experiments", "human_id")

    op.drop_column("datasets", "feature_count")
    op.drop_column("datasets", "row_count")
    op.drop_column("datasets", "size_label")
    op.drop_column("datasets", "purpose")
    op.drop_column("datasets", "verification_status")
    op.drop_column("datasets", "license_label")
    op.drop_column("datasets", "domain")
    op.drop_column("datasets", "publication_year")
    op.drop_column("datasets", "source_url")
    op.drop_column("datasets", "source_label")
    op.drop_column("datasets", "publisher")
    op.drop_column("datasets", "description")

    op.drop_index(op.f("ix_report_definitions_owner_user_id"), table_name="report_definitions")
    op.drop_index(op.f("ix_report_definitions_organization_id"), table_name="report_definitions")
    op.drop_table("report_definitions")
