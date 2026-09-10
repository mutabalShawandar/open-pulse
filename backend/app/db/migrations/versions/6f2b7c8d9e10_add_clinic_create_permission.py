"""add clinic.create permission

Revision ID: 6f2b7c8d9e10
Revises: b8f4c1a2d9e0
"""

from alembic import op
import sqlalchemy as sa


revision = "6f2b7c8d9e10"
down_revision = "b8f4c1a2d9e0"
branch_labels = None
depends_on = None

PERMISSION_ID = "10000000-0000-0000-0000-00000000000d"
PLATFORM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    op.execute(
        sa.text(
            "INSERT INTO permissions (id, name, description) "
            "VALUES (:permission_id, 'clinic.create', 'Allows creating clinics')"
        ).bindparams(
            sa.bindparam("permission_id", type_=sa.UUID()),
            permission_id=PERMISSION_ID,
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "VALUES (:role_id, :permission_id)"
        ).bindparams(
            sa.bindparam("role_id", type_=sa.UUID()),
            sa.bindparam("permission_id", type_=sa.UUID()),
            role_id=PLATFORM_ADMIN_ROLE_ID,
            permission_id=PERMISSION_ID,
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE permission_id = :permission_id"
        ).bindparams(permission_id=PERMISSION_ID)
    )
    op.execute(
        sa.text("DELETE FROM permissions WHERE id = :permission_id").bindparams(
            permission_id=PERMISSION_ID
        )
    )
