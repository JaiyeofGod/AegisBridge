"""Selected Wazuh alert provenance and generic integration sync runs.

Revision ID: 20261024_0018
Revises: 20261024_0017
Create Date: 2026-10-24 19:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261024_0018"
down_revision: str | Sequence[str] | None = "20261024_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TEXT_ARRAY = postgresql.ARRAY(sa.String())


def upgrade() -> None:
    op.add_column(
        "alert_references",
        sa.Column(
            "data_origin",
            sa.String(length=32),
            nullable=False,
            server_default="simulated",
        ),
    )
    op.add_column("alert_references", sa.Column("source_rule_id", sa.String(length=32)))
    op.add_column("alert_references", sa.Column("source_rule_level", sa.Integer()))
    op.add_column("alert_references", sa.Column("source_agent_id", sa.String(length=16)))
    op.add_column("alert_references", sa.Column("source_agent_name", sa.String(length=128)))
    op.add_column("alert_references", sa.Column("source_manager_name", sa.String(length=128)))
    op.add_column("alert_references", sa.Column("source_decoder", sa.String(length=64)))
    op.add_column("alert_references", sa.Column("source_src_ip", sa.String(length=45)))
    op.add_column("alert_references", sa.Column("source_dst_ip", sa.String(length=45)))
    op.add_column("alert_references", sa.Column("source_username", sa.String(length=128)))
    op.add_column(
        "alert_references",
        sa.Column("source_fetched_at", sa.DateTime(timezone=True)),
    )
    op.add_column(
        "alert_references",
        sa.Column("rule_groups", _TEXT_ARRAY, nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column(
        "alert_references",
        sa.Column(
            "attack_technique_ids",
            _TEXT_ARRAY,
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.add_column(
        "alert_references",
        sa.Column("attack_tactics", _TEXT_ARRAY, nullable=False, server_default=sa.text("'{}'")),
    )
    op.create_check_constraint(
        "ck_alert_references_data_origin",
        "alert_references",
        "data_origin IN ('simulated', 'wazuh')",
    )
    op.create_index(
        "uq_alert_references_wazuh_alert",
        "alert_references",
        ["organization_id", "wazuh_alert_id"],
        unique=True,
        postgresql_where=sa.text("wazuh_alert_id IS NOT NULL"),
    )
    op.create_table(
        "integration_sync_runs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("integration", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("received_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("inserted_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("malformed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("summary", sa.String(length=500)),
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
            "status IN ('skipped', 'completed', 'partial', 'failed')",
            name="ck_integration_sync_runs_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_integration_sync_runs_integration",
        "integration_sync_runs",
        ["integration"],
    )


def downgrade() -> None:
    op.drop_index("ix_integration_sync_runs_integration", table_name="integration_sync_runs")
    op.drop_table("integration_sync_runs")
    op.drop_index("uq_alert_references_wazuh_alert", table_name="alert_references")
    op.drop_constraint(
        "ck_alert_references_data_origin",
        "alert_references",
        type_="check",
    )
    for column in (
        "attack_tactics",
        "attack_technique_ids",
        "rule_groups",
        "source_fetched_at",
        "source_username",
        "source_dst_ip",
        "source_src_ip",
        "source_decoder",
        "source_manager_name",
        "source_agent_name",
        "source_agent_id",
        "source_rule_level",
        "source_rule_id",
        "data_origin",
    ):
        op.drop_column("alert_references", column)
