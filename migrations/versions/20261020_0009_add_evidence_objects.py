"""add evidence_objects for private object storage metadata

Revision ID: 20261020_0009
Revises: 20261020_0008
Create Date: 2026-10-22 04:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0009"
down_revision: str | Sequence[str] | None = "20261020_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "evidence_objects",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("evidence_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("bucket", sa.String(length=200), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=200), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("stored_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "sha256 ~ '^[0-9a-f]{64}$'",
            name=op.f("ck_evidence_objects_evidence_object_sha256_hex"),
        ),
        sa.ForeignKeyConstraint(
            ["evidence_id"],
            ["evidence.id"],
            name=op.f("fk_evidence_objects_evidence_id_evidence"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_evidence_objects")),
        sa.UniqueConstraint("evidence_id", name="uq_evidence_objects_evidence_id"),
    )
    op.create_index(
        op.f("ix_evidence_objects_evidence_id"),
        "evidence_objects",
        ["evidence_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_evidence_objects_evidence_id"), table_name="evidence_objects")
    op.drop_table("evidence_objects")
