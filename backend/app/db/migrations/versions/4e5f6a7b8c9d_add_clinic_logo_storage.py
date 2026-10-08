"""add private storage key for clinic logos"""

import sqlalchemy as sa
from alembic import op

revision = "4e5f6a7b8c9d"
down_revision = "3d4e5f6a7b8c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clinics", sa.Column("logo_storage_key", sa.String(length=512), nullable=True))
    op.create_index("ix_clinics_logo_storage_key", "clinics", ["logo_storage_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_clinics_logo_storage_key", table_name="clinics")
    op.drop_column("clinics", "logo_storage_key")
