"""Extend indicators for ThreatFox and URLhaus ingestion.

Revision ID: 20261024_0017
Revises: 20261024_0016
Create Date: 2026-10-24 13:40:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261024_0017"
down_revision: str | Sequence[str] | None = "20261024_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "threat_indicators",
        "value",
        existing_type=sa.String(length=500),
        type_=sa.String(length=2048),
        existing_nullable=False,
    )
    op.alter_column(
        "threat_indicators",
        "confidence",
        existing_type=sa.String(length=32),
        nullable=True,
    )
    op.add_column(
        "threat_indicators",
        sa.Column("normalized_value", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "threat_indicators",
        sa.Column("indicator_subtype", sa.String(length=16), nullable=True),
    )
    op.execute(
        """
        UPDATE threat_indicators
        SET normalized_value = lower(value),
            indicator_subtype = CASE
                WHEN indicator_type = 'url' THEN 'url'
                WHEN indicator_type = 'domain' THEN 'domain'
                WHEN indicator_type = 'ip' THEN 'ipv4'
                WHEN indicator_type = 'file_hash' AND char_length(value) = 64 THEN 'sha256'
                WHEN indicator_type = 'file_hash' AND char_length(value) = 40 THEN 'sha1'
                WHEN indicator_type = 'file_hash' AND char_length(value) = 32 THEN 'md5'
                ELSE 'sha256'
            END
        WHERE normalized_value IS NULL OR indicator_subtype IS NULL
        """
    )
    op.alter_column("threat_indicators", "normalized_value", nullable=False)
    op.alter_column("threat_indicators", "indicator_subtype", nullable=False)
    op.add_column(
        "threat_indicators",
        sa.Column("source_record_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "threat_indicators",
        sa.Column("threat_type", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "threat_indicators",
        sa.Column("malware_family", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "threat_indicators",
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String(length=64)),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
    )
    op.add_column(
        "threat_indicators",
        sa.Column("source_confidence", sa.Integer(), nullable=True),
    )
    op.add_column(
        "threat_indicators",
        sa.Column("source_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "threat_indicators",
        sa.Column("reference_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "threat_indicators",
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        op.f("ck_threat_indicators_subtype"),
        "threat_indicators",
        "indicator_subtype IN "
        "('ipv4', 'ipv6', 'domain', 'hostname', 'url', 'md5', 'sha1', 'sha256')",
    )
    op.create_check_constraint(
        op.f("ck_threat_indicators_source_confidence"),
        "threat_indicators",
        "source_confidence IS NULL OR (source_confidence >= 0 AND source_confidence <= 100)",
    )
    op.create_unique_constraint(
        op.f("uq_threat_indicators_source_indicator"),
        "threat_indicators",
        ["source_id", "indicator_subtype", "normalized_value"],
    )
    for name in (
        "threatfox_count",
        "urlhaus_count",
        "ioc_inserted_count",
        "ioc_updated_count",
        "ioc_skipped_count",
    ):
        op.add_column(
            "intelligence_sync_runs",
            sa.Column(name, sa.Integer(), server_default="0", nullable=False),
        )


def downgrade() -> None:
    for name in (
        "ioc_skipped_count",
        "ioc_updated_count",
        "ioc_inserted_count",
        "urlhaus_count",
        "threatfox_count",
    ):
        op.drop_column("intelligence_sync_runs", name)
    op.execute(
        """
        DELETE FROM threat_indicators
        WHERE confidence IS NULL OR char_length(value) > 500
        """
    )
    op.drop_constraint(
        op.f("uq_threat_indicators_source_indicator"),
        "threat_indicators",
        type_="unique",
    )
    op.drop_constraint(
        op.f("ck_threat_indicators_source_confidence"),
        "threat_indicators",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_threat_indicators_subtype"),
        "threat_indicators",
        type_="check",
    )
    for name in (
        "fetched_at",
        "reference_url",
        "source_status",
        "source_confidence",
        "tags",
        "malware_family",
        "threat_type",
        "source_record_id",
        "indicator_subtype",
        "normalized_value",
    ):
        op.drop_column("threat_indicators", name)
    op.alter_column(
        "threat_indicators",
        "value",
        existing_type=sa.String(length=2048),
        type_=sa.String(length=500),
        existing_nullable=False,
    )
    op.alter_column(
        "threat_indicators",
        "confidence",
        existing_type=sa.String(length=32),
        nullable=False,
    )
