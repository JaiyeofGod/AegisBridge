"""add directed lab system catalog relationships

Revision ID: 20261029_0021
Revises: 20261024_0020
Create Date: 2026-10-29 10:40:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261029_0021"
down_revision: str | Sequence[str] | None = "20261024_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lab_system_relationships",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("human_id", sa.String(length=32), nullable=False),
        sa.Column("source_system_id", sa.Uuid(), nullable=False),
        sa.Column("target_system_id", sa.Uuid(), nullable=False),
        sa.Column("relationship_kind", sa.String(length=32), nullable=False),
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
            "relationship_kind IN ('connected_to', 'depends_on', 'manages', 'monitors')",
            name=op.f("ck_lab_system_relationships_relationship_kind"),
        ),
        sa.CheckConstraint(
            "source_system_id <> target_system_id",
            name=op.f("ck_lab_system_relationships_distinct_systems"),
        ),
        sa.ForeignKeyConstraint(
            ["source_system_id"],
            ["lab_systems.id"],
            name=op.f("fk_lab_system_relationships_source_system_id_lab_systems"),
        ),
        sa.ForeignKeyConstraint(
            ["target_system_id"],
            ["lab_systems.id"],
            name=op.f("fk_lab_system_relationships_target_system_id_lab_systems"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lab_system_relationships")),
        sa.UniqueConstraint("human_id", name=op.f("uq_lab_system_relationships_human_id")),
        sa.UniqueConstraint(
            "source_system_id",
            "target_system_id",
            "relationship_kind",
            name=op.f("uq_lab_system_relationships_source_target_kind"),
        ),
    )
    op.create_index(
        op.f("ix_lab_system_relationships_source_system_id"),
        "lab_system_relationships",
        ["source_system_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lab_system_relationships_target_system_id"),
        "lab_system_relationships",
        ["target_system_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_lab_system_relationships_target_system_id"),
        table_name="lab_system_relationships",
    )
    op.drop_index(
        op.f("ix_lab_system_relationships_source_system_id"),
        table_name="lab_system_relationships",
    )
    op.drop_table("lab_system_relationships")
