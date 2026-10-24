"""Dataset revision provenance for research ingestion.

Revision ID: 20261024_0019
Revises: 20261024_0018
Create Date: 2026-10-24 19:40:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261024_0019"
down_revision: str | Sequence[str] | None = "20261024_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("dataset_versions", sa.Column("source_type", sa.String(length=32)))
    op.add_column("dataset_versions", sa.Column("source_revision", sa.String(length=64)))
    op.add_column("dataset_versions", sa.Column("source_reference", sa.String(length=500)))
    op.add_column("dataset_versions", sa.Column("ingestion_status", sa.String(length=32)))
    op.add_column("dataset_versions", sa.Column("validation_status", sa.String(length=32)))
    op.add_column(
        "dataset_versions",
        sa.Column("ingested_at", sa.DateTime(timezone=True)),
    )
    op.add_column("dataset_versions", sa.Column("row_count", sa.BigInteger()))
    op.add_column("dataset_versions", sa.Column("column_count", sa.Integer()))
    op.add_column("dataset_versions", sa.Column("byte_size", sa.BigInteger()))
    op.add_column("dataset_versions", sa.Column("artifact_sha256", sa.String(length=64)))
    op.add_column("dataset_versions", sa.Column("profile", postgresql.JSONB()))
    op.add_column("dataset_versions", sa.Column("error_summary", sa.String(length=500)))
    op.create_check_constraint(
        "ck_dataset_versions_ingestion_status",
        "dataset_versions",
        "ingestion_status IS NULL OR ingestion_status IN "
        "('downloading', 'validating', 'ready', 'failed')",
    )
    op.create_check_constraint(
        "ck_dataset_versions_validation_status",
        "dataset_versions",
        "validation_status IS NULL OR validation_status IN ('passed', 'failed')",
    )
    op.create_check_constraint(
        "ck_dataset_versions_artifact_sha256_hex",
        "dataset_versions",
        "artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$'",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_dataset_versions_artifact_sha256_hex",
        "dataset_versions",
        type_="check",
    )
    op.drop_constraint(
        "ck_dataset_versions_validation_status",
        "dataset_versions",
        type_="check",
    )
    op.drop_constraint(
        "ck_dataset_versions_ingestion_status",
        "dataset_versions",
        type_="check",
    )
    for column in (
        "error_summary",
        "profile",
        "artifact_sha256",
        "byte_size",
        "column_count",
        "row_count",
        "ingested_at",
        "validation_status",
        "ingestion_status",
        "source_reference",
        "source_revision",
        "source_type",
    ):
        op.drop_column("dataset_versions", column)
