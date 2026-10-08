"""add database defaults for platform user timestamps

Revision ID: b8f4c1a2d9e0
Revises: 4c4b7a4d0d1e
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b8f4c1a2d9e0"
down_revision: str | Sequence[str] | None = "4c4b7a4d0d1e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "created_at",
        server_default=sa.text("now()"),
    )
    op.alter_column(
        "users",
        "updated_at",
        server_default=sa.text("now()"),
    )


def downgrade() -> None:
    op.alter_column("users", "updated_at", server_default=None)
    op.alter_column("users", "created_at", server_default=None)
