"""seed organization_owner role

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-09-29 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


ORGANIZATION_OWNER_ROLE_ID = "00000000-0000-0000-0000-000000000004"

# Existing permission ids this role is granted, reused from prior seed migrations
# (4c4b7a4d0d1e_seed_authorization_data, 6f2b7c8d9e10_add_clinic_create_permission,
# c2a8e4f1d9b7_add_agency_survey_catalogue) rather than re-inserted here.
PERMISSION_IDS = {
    "clinic.read": "10000000-0000-0000-0000-000000000001",
    "clinic.create": "10000000-0000-0000-0000-00000000000d",
    "survey.create": "10000000-0000-0000-0000-000000000003",
    "survey.edit": "10000000-0000-0000-0000-000000000004",
    "survey.publish": "10000000-0000-0000-0000-000000000005",
    "survey.read": "10000000-0000-0000-0000-00000000000e",
    "survey.assign": "10000000-0000-0000-0000-00000000000f",
    "campaign.create": "10000000-0000-0000-0000-000000000006",
    "campaign.send": "10000000-0000-0000-0000-000000000007",
    "response.view": "10000000-0000-0000-0000-000000000008",
    "analytics.view": "10000000-0000-0000-0000-000000000009",
    "export.create": "10000000-0000-0000-0000-00000000000a",
    "role.assign": "10000000-0000-0000-0000-00000000000c",
}


def upgrade() -> None:
    """Upgrade schema."""
    roles = sa.table(
        "roles",
        sa.column("id", sa.UUID()),
        sa.column("name", sa.String()),
        sa.column("description", sa.String()),
    )
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", sa.UUID()),
        sa.column("permission_id", sa.UUID()),
    )

    op.bulk_insert(
        roles,
        [
            {
                "id": ORGANIZATION_OWNER_ROLE_ID,
                "name": "organization_owner",
                "description": "Can manage workspaces, surveys, and campaigns for the owning organization.",
            }
        ],
    )

    op.bulk_insert(
        role_permissions,
        [
            {"role_id": ORGANIZATION_OWNER_ROLE_ID, "permission_id": permission_id}
            for permission_id in PERMISSION_IDS.values()
        ],
    )


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    connection.execute(
        sa.text("DELETE FROM role_permissions WHERE role_id = :role_id"),
        {"role_id": ORGANIZATION_OWNER_ROLE_ID},
    )
    connection.execute(
        sa.text("DELETE FROM roles WHERE id = :role_id"),
        {"role_id": ORGANIZATION_OWNER_ROLE_ID},
    )
