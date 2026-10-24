"""Add the pinned MITRE ATT&CK Enterprise catalog.

Revision ID: 20261024_0016
Revises: 20261024_0015
Create Date: 2026-10-24 03:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261024_0016"
down_revision: str | Sequence[str] | None = "20261024_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attack_releases",
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
        sa.Column("domain", sa.String(length=32), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=80), nullable=False),
        sa.Column("stix_version", sa.String(length=16), nullable=False),
        sa.Column("bundle_sha256", sa.String(length=64), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.CheckConstraint("domain IN ('enterprise')", name="ck_attack_releases_domain"),
        sa.CheckConstraint(
            "bundle_sha256 ~ '^[0-9a-f]{64}$'",
            name="ck_attack_releases_bundle_sha256_hex",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_attack_releases"),
        sa.UniqueConstraint("domain", "version", name="uq_attack_releases_domain_version"),
    )
    op.create_index(
        "uq_attack_releases_one_active",
        "attack_releases",
        ["domain"],
        unique=True,
        postgresql_where=sa.text("active"),
    )
    op.create_table(
        "attack_catalog_tactics",
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
        sa.Column("release_id", sa.Uuid(), nullable=False),
        sa.Column("stix_id", sa.String(length=160), nullable=False),
        sa.Column("external_id", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("short_name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("object_version", sa.String(length=16), nullable=True),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.Column("deprecated", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["release_id"],
            ["attack_releases.id"],
            name="fk_attack_catalog_tactics_release_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_attack_catalog_tactics"),
        sa.UniqueConstraint(
            "release_id",
            "stix_id",
            name="uq_attack_catalog_tactics_release_stix",
        ),
        sa.UniqueConstraint(
            "release_id",
            "external_id",
            name="uq_attack_catalog_tactics_release_external",
        ),
        sa.UniqueConstraint(
            "release_id",
            "short_name",
            name="uq_attack_catalog_tactics_release_short_name",
        ),
    )
    op.create_index(
        "ix_attack_catalog_tactics_release_id",
        "attack_catalog_tactics",
        ["release_id"],
    )
    op.create_table(
        "attack_catalog_techniques",
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
        sa.Column("release_id", sa.Uuid(), nullable=False),
        sa.Column("parent_technique_id", sa.Uuid(), nullable=True),
        sa.Column("stix_id", sa.String(length=160), nullable=False),
        sa.Column("external_id", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_subtechnique", sa.Boolean(), nullable=False),
        sa.Column(
            "platforms",
            postgresql.ARRAY(sa.String(length=64)),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column("object_version", sa.String(length=16), nullable=True),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.Column("deprecated", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["parent_technique_id"],
            ["attack_catalog_techniques.id"],
            name="fk_attack_catalog_techniques_parent_id",
        ),
        sa.ForeignKeyConstraint(
            ["release_id"],
            ["attack_releases.id"],
            name="fk_attack_catalog_techniques_release_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_attack_catalog_techniques"),
        sa.UniqueConstraint(
            "release_id",
            "stix_id",
            name="uq_attack_catalog_techniques_release_stix",
        ),
        sa.UniqueConstraint(
            "release_id",
            "external_id",
            name="uq_attack_catalog_techniques_release_external",
        ),
    )
    op.create_index(
        "ix_attack_catalog_techniques_release_id",
        "attack_catalog_techniques",
        ["release_id"],
    )
    op.create_index(
        "ix_attack_catalog_techniques_parent_technique_id",
        "attack_catalog_techniques",
        ["parent_technique_id"],
    )
    op.create_table(
        "attack_catalog_tactic_links",
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
        sa.Column("technique_id", sa.Uuid(), nullable=False),
        sa.Column("tactic_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["tactic_id"],
            ["attack_catalog_tactics.id"],
            name="fk_attack_catalog_tactic_links_tactic_id",
        ),
        sa.ForeignKeyConstraint(
            ["technique_id"],
            ["attack_catalog_techniques.id"],
            name="fk_attack_catalog_tactic_links_technique_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_attack_catalog_tactic_links"),
        sa.UniqueConstraint(
            "technique_id",
            "tactic_id",
            name="uq_attack_catalog_tactic_links_technique_tactic",
        ),
    )
    op.create_index(
        "ix_attack_catalog_tactic_links_technique_id",
        "attack_catalog_tactic_links",
        ["technique_id"],
    )
    op.create_index(
        "ix_attack_catalog_tactic_links_tactic_id",
        "attack_catalog_tactic_links",
        ["tactic_id"],
    )


def downgrade() -> None:
    op.drop_table("attack_catalog_tactic_links")
    op.drop_table("attack_catalog_techniques")
    op.drop_table("attack_catalog_tactics")
    op.drop_index("uq_attack_releases_one_active", table_name="attack_releases")
    op.drop_table("attack_releases")
