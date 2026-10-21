"""add cyber range catalog and detection metadata

Revision ID: 20261020_0005
Revises: 20261020_0004
Create Date: 2026-10-20 24:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_0005"
down_revision: str | Sequence[str] | None = "20261020_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("detections", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("detections", sa.Column("data_source", sa.String(length=120), nullable=True))
    op.add_column(
        "detections", sa.Column("sigma_reference", sa.String(length=240), nullable=True)
    )
    op.add_column(
        "detections", sa.Column("wazuh_mapping_status", sa.String(length=120), nullable=True)
    )
    op.add_column(
        "detections", sa.Column("validation_state", sa.String(length=32), nullable=True)
    )
    op.add_column(
        "detections",
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("detections", sa.Column("notes", sa.Text(), nullable=True))

    op.create_table(
        "lab_zones",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("human_id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("cidr", sa.String(length=64), nullable=False),
        sa.Column("gateway", sa.String(length=64), nullable=True),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("observed_state", sa.String(length=32), nullable=False),
        sa.Column("isolation_notes", sa.Text(), nullable=True),
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
            "status IN ('planned', 'defined', 'reference_only')",
            name=op.f("ck_lab_zones_status"),
        ),
        sa.CheckConstraint(
            "observed_state IN ('not_observed', 'simulated', 'reference_only')",
            name=op.f("ck_lab_zones_observed_state"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_lab_zones_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lab_zones")),
        sa.UniqueConstraint("human_id", name=op.f("uq_lab_zones_human_id")),
    )
    op.create_index(
        op.f("ix_lab_zones_organization_id"), "lab_zones", ["organization_id"], unique=False
    )

    op.create_table(
        "lab_systems",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("zone_id", sa.Uuid(), nullable=False),
        sa.Column("human_id", sa.String(length=32), nullable=False),
        sa.Column("hostname", sa.String(length=120), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("role", sa.String(length=120), nullable=False),
        sa.Column("platform", sa.String(length=120), nullable=True),
        sa.Column("expected_state", sa.String(length=32), nullable=False),
        sa.Column("observed_state", sa.String(length=32), nullable=False),
        sa.Column("telemetry_source", sa.String(length=200), nullable=True),
        sa.Column("telemetry_expected", sa.Boolean(), nullable=False),
        sa.Column("telemetry_status", sa.String(length=32), nullable=False),
        sa.Column("telemetry_freshness", sa.String(length=64), nullable=True),
        sa.Column("telemetry_semantics", sa.Text(), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_origin", sa.String(length=64), nullable=False),
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
            "expected_state IN ('planned', 'approved', 'retired')",
            name=op.f("ck_lab_systems_expected_state"),
        ),
        sa.CheckConstraint(
            "observed_state IN ("
            "'not_observed', 'simulated_reporting', 'simulated_stopped', 'reference_only'"
            ")",
            name=op.f("ck_lab_systems_observed_state"),
        ),
        sa.CheckConstraint(
            "telemetry_status IN ("
            "'not_connected', 'not_reporting', 'simulated', 'reference_only'"
            ")",
            name=op.f("ck_lab_systems_telemetry_status"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_lab_systems_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["zone_id"],
            ["lab_zones.id"],
            name=op.f("fk_lab_systems_zone_id_lab_zones"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lab_systems")),
        sa.UniqueConstraint("human_id", name=op.f("uq_lab_systems_human_id")),
    )
    op.create_index(
        op.f("ix_lab_systems_organization_id"),
        "lab_systems",
        ["organization_id"],
        unique=False,
    )
    op.create_index(op.f("ix_lab_systems_zone_id"), "lab_systems", ["zone_id"], unique=False)

    op.create_table(
        "lab_scenarios",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("human_id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("objective", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("expected_telemetry", sa.Text(), nullable=True),
        sa.Column("safety_notes", sa.Text(), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
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
            "status IN ('planned', 'ready', 'simulated', 'validated', 'retired')",
            name=op.f("ck_lab_scenarios_status"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_lab_scenarios_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lab_scenarios")),
        sa.UniqueConstraint("human_id", name=op.f("uq_lab_scenarios_human_id")),
    )
    op.create_index(
        op.f("ix_lab_scenarios_organization_id"),
        "lab_scenarios",
        ["organization_id"],
        unique=False,
    )

    op.create_table(
        "lab_scenario_systems",
        sa.Column("scenario_id", sa.Uuid(), nullable=False),
        sa.Column("lab_system_id", sa.Uuid(), nullable=False),
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
            ["lab_system_id"],
            ["lab_systems.id"],
            name=op.f("fk_lab_scenario_systems_lab_system_id_lab_systems"),
        ),
        sa.ForeignKeyConstraint(
            ["scenario_id"],
            ["lab_scenarios.id"],
            name=op.f("fk_lab_scenario_systems_scenario_id_lab_scenarios"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lab_scenario_systems")),
        sa.UniqueConstraint(
            "scenario_id", "lab_system_id", name=op.f("uq_lab_scenario_systems")
        ),
    )
    op.create_index(
        op.f("ix_lab_scenario_systems_lab_system_id"),
        "lab_scenario_systems",
        ["lab_system_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lab_scenario_systems_scenario_id"),
        "lab_scenario_systems",
        ["scenario_id"],
        unique=False,
    )

    op.create_table(
        "lab_scenario_detections",
        sa.Column("scenario_id", sa.Uuid(), nullable=False),
        sa.Column("detection_id", sa.Uuid(), nullable=False),
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
            ["detection_id"],
            ["detections.id"],
            name=op.f("fk_lab_scenario_detections_detection_id_detections"),
        ),
        sa.ForeignKeyConstraint(
            ["scenario_id"],
            ["lab_scenarios.id"],
            name=op.f("fk_lab_scenario_detections_scenario_id_lab_scenarios"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lab_scenario_detections")),
        sa.UniqueConstraint(
            "scenario_id", "detection_id", name=op.f("uq_lab_scenario_detections")
        ),
    )
    op.create_index(
        op.f("ix_lab_scenario_detections_detection_id"),
        "lab_scenario_detections",
        ["detection_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lab_scenario_detections_scenario_id"),
        "lab_scenario_detections",
        ["scenario_id"],
        unique=False,
    )

    op.create_table(
        "lab_scenario_attack_mappings",
        sa.Column("scenario_id", sa.Uuid(), nullable=False),
        sa.Column("attack_technique_id", sa.Uuid(), nullable=False),
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
            ["attack_technique_id"],
            ["attack_techniques.id"],
            name=op.f(
                "fk_lab_scenario_attack_mappings_attack_technique_id_attack_techniques"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["scenario_id"],
            ["lab_scenarios.id"],
            name=op.f("fk_lab_scenario_attack_mappings_scenario_id_lab_scenarios"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lab_scenario_attack_mappings")),
        sa.UniqueConstraint(
            "scenario_id",
            "attack_technique_id",
            name=op.f("uq_lab_scenario_attack_mappings"),
        ),
    )
    op.create_index(
        op.f("ix_lab_scenario_attack_mappings_attack_technique_id"),
        "lab_scenario_attack_mappings",
        ["attack_technique_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lab_scenario_attack_mappings_scenario_id"),
        "lab_scenario_attack_mappings",
        ["scenario_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_lab_scenario_attack_mappings_scenario_id"),
        table_name="lab_scenario_attack_mappings",
    )
    op.drop_index(
        op.f("ix_lab_scenario_attack_mappings_attack_technique_id"),
        table_name="lab_scenario_attack_mappings",
    )
    op.drop_table("lab_scenario_attack_mappings")
    op.drop_index(
        op.f("ix_lab_scenario_detections_scenario_id"),
        table_name="lab_scenario_detections",
    )
    op.drop_index(
        op.f("ix_lab_scenario_detections_detection_id"),
        table_name="lab_scenario_detections",
    )
    op.drop_table("lab_scenario_detections")
    op.drop_index(
        op.f("ix_lab_scenario_systems_scenario_id"), table_name="lab_scenario_systems"
    )
    op.drop_index(
        op.f("ix_lab_scenario_systems_lab_system_id"), table_name="lab_scenario_systems"
    )
    op.drop_table("lab_scenario_systems")
    op.drop_index(op.f("ix_lab_scenarios_organization_id"), table_name="lab_scenarios")
    op.drop_table("lab_scenarios")
    op.drop_index(op.f("ix_lab_systems_zone_id"), table_name="lab_systems")
    op.drop_index(op.f("ix_lab_systems_organization_id"), table_name="lab_systems")
    op.drop_table("lab_systems")
    op.drop_index(op.f("ix_lab_zones_organization_id"), table_name="lab_zones")
    op.drop_table("lab_zones")
    op.drop_column("detections", "notes")
    op.drop_column("detections", "last_validated_at")
    op.drop_column("detections", "validation_state")
    op.drop_column("detections", "wazuh_mapping_status")
    op.drop_column("detections", "sigma_reference")
    op.drop_column("detections", "data_source")
    op.drop_column("detections", "description")
