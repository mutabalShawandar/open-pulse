"""rename clinic to workspace

Revision ID: 9ec79f82d837
Revises: 4ceedb341bab
Create Date: 2026-09-28 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "9ec79f82d837"
down_revision: str | Sequence[str] | None = "4ceedb341bab"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DEFAULT_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Rename the clinics table itself and give every existing row an
    #    organization. A pre-existing local/dev database has no organization
    #    to attach workspaces to yet, so create one default organization and
    #    backfill every workspace onto it; this is a no-op on a fresh database.
    op.rename_table("clinics", "workspaces")
    op.add_column("workspaces", sa.Column("organization_id", sa.UUID(), nullable=True))

    organizations = sa.table(
        "organizations",
        sa.column("id", UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
    )
    op.execute(
        organizations.insert().values(
            id=DEFAULT_ORGANIZATION_ID,
            name="Default Organization",
            slug="default-organization",
        )
    )
    op.execute(
        f"UPDATE workspaces SET organization_id = '{DEFAULT_ORGANIZATION_ID}' WHERE organization_id IS NULL"
    )
    op.alter_column("workspaces", "organization_id", nullable=False)
    op.create_index(
        op.f("ix_workspaces_organization_id"), "workspaces", ["organization_id"], unique=False
    )
    op.create_foreign_key(
        "fk_workspaces_organization_id_organizations",
        "workspaces",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 2. clinic_members -> workspace_members
    op.rename_table("clinic_members", "workspace_members")
    op.alter_column("workspace_members", "clinic_id", new_column_name="workspace_id")

    # 3. survey_version_clinics -> survey_version_workspaces
    op.rename_table("survey_version_clinics", "survey_version_workspaces")
    op.alter_column("survey_version_workspaces", "clinic_id", new_column_name="workspace_id")
    op.drop_index(
        "uq_survey_version_clinics_active_assignment", table_name="survey_version_workspaces"
    )
    op.create_index(
        "uq_survey_version_workspaces_active_assignment",
        "survey_version_workspaces",
        ["survey_version_id", "workspace_id"],
        unique=True,
        postgresql_where=sa.text("unassigned_at IS NULL"),
    )

    # 4. clinic_id -> workspace_id on recipients, campaigns, audit_events
    op.drop_constraint("uq_recipients_clinic_email_normalized", "recipients", type_="unique")
    op.alter_column("recipients", "clinic_id", new_column_name="workspace_id")
    op.create_unique_constraint(
        "uq_recipients_workspace_email_normalized",
        "recipients",
        ["workspace_id", "email_normalized"],
    )

    op.drop_index("ix_campaigns_clinic_status", table_name="campaigns")
    op.alter_column("campaigns", "clinic_id", new_column_name="workspace_id")
    op.create_index(
        "ix_campaigns_workspace_status", "campaigns", ["workspace_id", "status"], unique=False
    )

    op.alter_column("audit_events", "clinic_id", new_column_name="workspace_id")


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column("audit_events", "workspace_id", new_column_name="clinic_id")

    op.drop_index("ix_campaigns_workspace_status", table_name="campaigns")
    op.alter_column("campaigns", "workspace_id", new_column_name="clinic_id")
    op.create_index(
        "ix_campaigns_clinic_status", "campaigns", ["clinic_id", "status"], unique=False
    )

    op.drop_constraint("uq_recipients_workspace_email_normalized", "recipients", type_="unique")
    op.alter_column("recipients", "workspace_id", new_column_name="clinic_id")
    op.create_unique_constraint(
        "uq_recipients_clinic_email_normalized", "recipients", ["clinic_id", "email_normalized"]
    )

    op.drop_index(
        "uq_survey_version_workspaces_active_assignment", table_name="survey_version_workspaces"
    )
    op.create_index(
        "uq_survey_version_clinics_active_assignment",
        "survey_version_workspaces",
        ["survey_version_id", "workspace_id"],
        unique=True,
        postgresql_where=sa.text("unassigned_at IS NULL"),
    )
    op.alter_column("survey_version_workspaces", "workspace_id", new_column_name="clinic_id")
    op.rename_table("survey_version_workspaces", "survey_version_clinics")

    op.alter_column("workspace_members", "workspace_id", new_column_name="clinic_id")
    op.rename_table("workspace_members", "clinic_members")

    op.drop_constraint(
        "fk_workspaces_organization_id_organizations", "workspaces", type_="foreignkey"
    )
    op.drop_index(op.f("ix_workspaces_organization_id"), table_name="workspaces")
    op.drop_column("workspaces", "organization_id")
    op.rename_table("workspaces", "clinics")
