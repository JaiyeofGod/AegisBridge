"""Empty baseline schema.

Revision ID: 20261020_0001
Revises:
Create Date: 2026-10-20

Phase 1 intentionally creates no application tables.
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "20261020_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
