"""add threat intelligence records and integration human ids

Revision ID: 20261020_0003
Revises: 20261020_0002
Create Date: 2026-10-20 22:45:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0003"
down_revision: str | Sequence[str] | None = "20261020_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("integrations", sa.Column("human_id", sa.String(length=32), nullable=True))
    op.create_unique_constraint(op.f("uq_integrations_human_id"), "integrations", ["human_id"])

    op.create_table(
        "threat_intel_sources",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("human_id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("connection_status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
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
            "connection_status IN ('configured', 'reference_only', 'not_connected', "
            "'delayed', 'healthy')",
            name=op.f("ck_threat_intel_sources_connection_status"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_threat_intel_sources_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_threat_intel_sources")),
        sa.UniqueConstraint("human_id", name=op.f("uq_threat_intel_sources_human_id")),
    )
    op.create_index(
        op.f("ix_threat_intel_sources_organization_id"),
        "threat_intel_sources",
        ["organization_id"],
        unique=False,
    )

    op.create_table(
        "threat_indicators",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("matched_asset_id", sa.Uuid(), nullable=True),
        sa.Column("attack_technique_id", sa.Uuid(), nullable=True),
        sa.Column("human_id", sa.String(length=32), nullable=False),
        sa.Column("indicator_type", sa.String(length=32), nullable=False),
        sa.Column("value", sa.String(length=500), nullable=False),
        sa.Column("confidence", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("internal_match", sa.Boolean(), nullable=False),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
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
            "indicator_type IN ('ip', 'domain', 'url', 'file_hash')",
            name=op.f("ck_threat_indicators_indicator_type"),
        ),
        sa.CheckConstraint(
            "status IN ('active', 'expired', 'retracted')",
            name=op.f("ck_threat_indicators_status"),
        ),
        sa.CheckConstraint(
            "confidence IN ('high', 'medium', 'low')",
            name=op.f("ck_threat_indicators_confidence"),
        ),
        sa.ForeignKeyConstraint(
            ["attack_technique_id"],
            ["attack_techniques.id"],
            name=op.f("fk_threat_indicators_attack_technique_id_attack_techniques"),
        ),
        sa.ForeignKeyConstraint(
            ["matched_asset_id"],
            ["assets.id"],
            name=op.f("fk_threat_indicators_matched_asset_id_assets"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_threat_indicators_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["threat_intel_sources.id"],
            name=op.f("fk_threat_indicators_source_id_threat_intel_sources"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_threat_indicators")),
        sa.UniqueConstraint("human_id", name=op.f("uq_threat_indicators_human_id")),
    )
    op.create_index(
        op.f("ix_threat_indicators_organization_id"),
        "threat_indicators",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_threat_indicators_source_id"),
        "threat_indicators",
        ["source_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_threat_indicators_matched_asset_id"),
        "threat_indicators",
        ["matched_asset_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_threat_indicators_attack_technique_id"),
        "threat_indicators",
        ["attack_technique_id"],
        unique=False,
    )

    op.create_table(
        "threat_advisories",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("human_id", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("confidence", sa.String(length=32), nullable=True),
        sa.Column("related_cve", sa.String(length=32), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_threat_advisories_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["threat_intel_sources.id"],
            name=op.f("fk_threat_advisories_source_id_threat_intel_sources"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_threat_advisories")),
        sa.UniqueConstraint("human_id", name=op.f("uq_threat_advisories_human_id")),
    )
    op.create_index(
        op.f("ix_threat_advisories_organization_id"),
        "threat_advisories",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_threat_advisories_source_id"),
        "threat_advisories",
        ["source_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_threat_advisories_source_id"), table_name="threat_advisories")
    op.drop_index(op.f("ix_threat_advisories_organization_id"), table_name="threat_advisories")
    op.drop_table("threat_advisories")
    op.drop_index(op.f("ix_threat_indicators_attack_technique_id"), table_name="threat_indicators")
    op.drop_index(op.f("ix_threat_indicators_matched_asset_id"), table_name="threat_indicators")
    op.drop_index(op.f("ix_threat_indicators_source_id"), table_name="threat_indicators")
    op.drop_index(op.f("ix_threat_indicators_organization_id"), table_name="threat_indicators")
    op.drop_table("threat_indicators")
    op.drop_index(op.f("ix_threat_intel_sources_organization_id"), table_name="threat_intel_sources")
    op.drop_table("threat_intel_sources")
    op.drop_constraint(op.f("uq_integrations_human_id"), "integrations", type_="unique")
    op.drop_column("integrations", "human_id")
