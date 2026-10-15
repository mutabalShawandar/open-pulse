"""grant clinic_manager survey.read and survey.assign

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-09-29 00:00:00.000000

Pre-existing gap noted while wiring workspace-scoped authorization
(MIGRATION_PLAN.md Step 6): survey.read and survey.assign were only ever
seeded to platform_admin (c2a8e4f1d9b7_add_agency_survey_catalogue), so a
clinic_manager could never list or assign published survey versions for
their own workspace even though clinic_survey_versions.py gates those
routes on exactly these two permissions via require_clinic_permission.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7a8b9"
down_revision: str | Sequence[str] | None = "b3c4d5e6f7a8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CLINIC_MANAGER_ROLE_ID = "00000000-0000-0000-0000-000000000002"
SURVEY_READ_PERMISSION_ID = "10000000-0000-0000-0000-00000000000e"
SURVEY_ASSIGN_PERMISSION_ID = "10000000-0000-0000-0000-00000000000f"


def upgrade() -> None:
    """Upgrade schema."""
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", sa.UUID()),
        sa.column("permission_id", sa.UUID()),
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role_id": CLINIC_MANAGER_ROLE_ID, "permission_id": SURVEY_READ_PERMISSION_ID},
            {"role_id": CLINIC_MANAGER_ROLE_ID, "permission_id": SURVEY_ASSIGN_PERMISSION_ID},
        ],
    )


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE role_id = :role_id AND permission_id IN :permission_ids"
        ).bindparams(
            sa.bindparam("permission_ids", expanding=True),
        ),
        {
            "role_id": CLINIC_MANAGER_ROLE_ID,
            "permission_ids": [SURVEY_READ_PERMISSION_ID, SURVEY_ASSIGN_PERMISSION_ID],
        },
    )
