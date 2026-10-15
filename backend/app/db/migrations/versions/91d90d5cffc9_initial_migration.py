"""initial migration

Revision ID: 91d90d5cffc9
Revises:
Create Date: 2026-09-04 16:31:33.735495

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "91d90d5cffc9"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
