"""add readable public campaign paths

Revision ID: 3d4e5f6a7b8c
Revises: 1b2c3d4e5f6a
"""

import re
import unicodedata

import sqlalchemy as sa
from alembic import op

revision = "3d4e5f6a7b8c"
down_revision = "1b2c3d4e5f6a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("public_path", sa.String(length=128), nullable=True))
    op.create_index("ix_campaigns_public_path", "campaigns", ["public_path"], unique=True)
    connection = op.get_bind()
    used_paths = set(
        connection.execute(
            sa.text("SELECT public_path FROM campaigns WHERE public_path IS NOT NULL")
        ).scalars()
    )
    campaigns = connection.execute(
        sa.text("SELECT id, title FROM campaigns WHERE public_path IS NULL ORDER BY created_at, id")
    ).mappings()
    for campaign in campaigns:
        normalized = (
            unicodedata.normalize("NFKD", campaign["title"].replace("ß", "ss"))
            .encode("ascii", "ignore")
            .decode("ascii")
            .lower()
        )
        base = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")[:80] or "umfrage"
        path = base
        suffix = 2
        while path in used_paths:
            suffix_text = f"-{suffix}"
            path = f"{base[: 128 - len(suffix_text)]}{suffix_text}"
            suffix += 1
        connection.execute(
            sa.text("UPDATE campaigns SET public_path = :path WHERE id = :id"),
            {"path": path, "id": campaign["id"]},
        )
        used_paths.add(path)


def downgrade() -> None:
    op.drop_index("ix_campaigns_public_path", table_name="campaigns")
    op.drop_column("campaigns", "public_path")
