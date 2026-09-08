"""seed initial authorization data

Revision ID: 4c4b7a4d0d1e
Revises: 7a9d724e2222
"""

from alembic import op
import sqlalchemy as sa


revision = "4c4b7a4d0d1e"
down_revision = "7a9d724e2222"
branch_labels = None
depends_on = None


ROLE_IDS = {
    "platform_admin": "00000000-0000-0000-0000-000000000001",
    "clinic_manager": "00000000-0000-0000-0000-000000000002",
    "clinic_viewer": "00000000-0000-0000-0000-000000000003",
}

PERMISSION_IDS = {
    "clinic.read": "10000000-0000-0000-0000-000000000001",
    "user.manage": "10000000-0000-0000-0000-000000000002",
    "survey.create": "10000000-0000-0000-0000-000000000003",
    "survey.edit": "10000000-0000-0000-0000-000000000004",
    "survey.publish": "10000000-0000-0000-0000-000000000005",
    "campaign.create": "10000000-0000-0000-0000-000000000006",
    "campaign.send": "10000000-0000-0000-0000-000000000007",
    "response.view": "10000000-0000-0000-0000-000000000008",
    "analytics.view": "10000000-0000-0000-0000-000000000009",
    "export.create": "10000000-0000-0000-0000-00000000000a",
    "audit.view": "10000000-0000-0000-0000-00000000000b",
    "role.assign": "10000000-0000-0000-0000-00000000000c",
}


def upgrade() -> None:
    roles = sa.table(
        "roles",
        sa.column("id", sa.UUID()),
        sa.column("name", sa.String()),
        sa.column("description", sa.String()),
    )
    permissions = sa.table(
        "permissions",
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
                "id": role_id,
                "name": name,
                "description": description,
            }
            for name, role_id, description in [
                (
                    "platform_admin",
                    ROLE_IDS["platform_admin"],
                    "Can manage platform users, clinics, roles, and permissions.",
                ),
                (
                    "clinic_manager",
                    ROLE_IDS["clinic_manager"],
                    "Can manage surveys and campaigns for assigned clinics.",
                ),
                (
                    "clinic_viewer",
                    ROLE_IDS["clinic_viewer"],
                    "Can view assigned clinic data and analytics.",
                ),
            ]
        ],
    )

    op.bulk_insert(
        permissions,
        [
            {
                "id": permission_id,
                "name": name,
                "description": f"Allows the {name} operation.",
            }
            for name, permission_id in PERMISSION_IDS.items()
        ],
    )

    admin_permissions = set(PERMISSION_IDS)
    manager_permissions = {
        "clinic.read",
        "survey.create",
        "survey.edit",
        "survey.publish",
        "campaign.create",
        "campaign.send",
        "response.view",
        "analytics.view",
        "export.create",
    }
    viewer_permissions = {
        "clinic.read",
        "response.view",
        "analytics.view",
    }

    assignments = []
    for role_name, permission_names in {
        "platform_admin": admin_permissions,
        "clinic_manager": manager_permissions,
        "clinic_viewer": viewer_permissions,
    }.items():
        assignments.extend(
            {
                "role_id": ROLE_IDS[role_name],
                "permission_id": PERMISSION_IDS[permission_name],
            }
            for permission_name in permission_names
        )

    op.bulk_insert(role_permissions, assignments)


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "DELETE FROM role_permissions "
            "WHERE role_id IN :role_ids OR permission_id IN :permission_ids"
        ).bindparams(
            sa.bindparam("role_ids", expanding=True),
            sa.bindparam("permission_ids", expanding=True),
        ),
        {
            "role_ids": list(ROLE_IDS.values()),
            "permission_ids": list(PERMISSION_IDS.values()),
        },
    )
    connection.execute(
        sa.text("DELETE FROM roles WHERE id IN :role_ids").bindparams(
            sa.bindparam("role_ids", expanding=True)
        ),
        {"role_ids": list(ROLE_IDS.values())},
    )
    connection.execute(
        sa.text("DELETE FROM permissions WHERE id IN :permission_ids").bindparams(
            sa.bindparam("permission_ids", expanding=True)
        ),
        {"permission_ids": list(PERMISSION_IDS.values())},
    )
