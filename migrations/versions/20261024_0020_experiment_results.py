"""Structured results for dataset experiments.

Revision ID: 20261024_0020
Revises: 20261024_0019
Create Date: 2026-10-24 21:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261024_0020"
down_revision: str | Sequence[str] | None = "20261024_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("dataset_experiments", sa.Column("config", postgresql.JSONB()))
    op.add_column("dataset_experiments", sa.Column("metrics", postgresql.JSONB()))
    op.add_column("dataset_experiments", sa.Column("model_sha256", sa.String(length=64)))
    op.add_column(
        "dataset_experiments", sa.Column("vocabulary_sha256", sa.String(length=64))
    )
    op.add_column("dataset_experiments", sa.Column("manifest_sha256", sa.String(length=64)))
    op.add_column("dataset_experiments", sa.Column("private_artifacts", postgresql.JSONB()))
    op.create_check_constraint(
        "ck_dataset_experiments_model_sha256_hex",
        "dataset_experiments",
        "model_sha256 IS NULL OR model_sha256 ~ '^[0-9a-f]{64}$'",
    )
    op.create_check_constraint(
        "ck_dataset_experiments_vocabulary_sha256_hex",
        "dataset_experiments",
        "vocabulary_sha256 IS NULL OR vocabulary_sha256 ~ '^[0-9a-f]{64}$'",
    )
    op.create_check_constraint(
        "ck_dataset_experiments_manifest_sha256_hex",
        "dataset_experiments",
        "manifest_sha256 IS NULL OR manifest_sha256 ~ '^[0-9a-f]{64}$'",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_dataset_experiments_manifest_sha256_hex",
        "dataset_experiments",
        type_="check",
    )
    op.drop_constraint(
        "ck_dataset_experiments_vocabulary_sha256_hex",
        "dataset_experiments",
        type_="check",
    )
    op.drop_constraint(
        "ck_dataset_experiments_model_sha256_hex",
        "dataset_experiments",
        type_="check",
    )
    for column in (
        "private_artifacts",
        "manifest_sha256",
        "vocabulary_sha256",
        "model_sha256",
        "metrics",
        "config",
    ):
        op.drop_column("dataset_experiments", column)
