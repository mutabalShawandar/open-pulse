"""add optional other-answer support to survey questions

Revision ID: d4e5f6a7b8c9
Revises: c2a8e4f1d9b7
"""

import sqlalchemy as sa
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c2a8e4f1d9b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "survey_questions",
        sa.Column("allow_other", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("survey_questions", "allow_other")
