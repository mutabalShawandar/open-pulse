"""record public response legal acceptance"""

from alembic import op
import sqlalchemy as sa


revision = "5f6a7b8c9d0e"
down_revision = "4e5f6a7b8c9d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("survey_responses", sa.Column("legal_accepted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("survey_responses", "legal_accepted_at")
