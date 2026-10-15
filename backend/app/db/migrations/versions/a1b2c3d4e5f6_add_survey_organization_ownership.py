"""add survey organization ownership

Revision ID: a1b2c3d4e5f6
Revises: 9ec79f82d837
Create Date: 2026-09-28 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "9ec79f82d837"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("surveys", sa.Column("organization_id", sa.UUID(), nullable=True))

    # Backfill from the organization of any workspace the survey's versions are already
    # assigned to; surveys with no assignment fall back to the earliest organization.
    op.execute(
        """
        UPDATE surveys
        SET organization_id = backfill.organization_id
        FROM (
            SELECT DISTINCT ON (sv.survey_id) sv.survey_id, w.organization_id
            FROM survey_versions sv
            JOIN survey_version_workspaces svw ON svw.survey_version_id = sv.id
            JOIN workspaces w ON w.id = svw.workspace_id
            ORDER BY sv.survey_id, svw.assigned_at ASC
        ) AS backfill
        WHERE surveys.id = backfill.survey_id
        """
    )
    op.execute(
        """
        UPDATE surveys
        SET organization_id = (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1)
        WHERE organization_id IS NULL
        """
    )

    op.alter_column("surveys", "organization_id", nullable=False)
    op.create_index(
        op.f("ix_surveys_organization_id"), "surveys", ["organization_id"], unique=False
    )
    op.create_foreign_key(
        "fk_surveys_organization_id",
        "surveys",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_surveys_organization_id", "surveys", type_="foreignkey")
    op.drop_index(op.f("ix_surveys_organization_id"), table_name="surveys")
    op.drop_column("surveys", "organization_id")
