"""reconcile indexes and constraints after workspace rename

The clinic -> workspace rename migration renamed tables and columns but left the
indexes with their old ``ix_clinics_*`` names, and several unique constraints were
created differently from how the models declare them (a UNIQUE constraint instead of a
unique index). ``alembic check`` therefore reported drift between the migrated schema
and the models. This migration makes the database match the models:

* renames the leftover ``clinic`` indexes to their ``workspace`` names,
* replaces five UNIQUE constraints with the equivalent unique indexes
  (uniqueness is enforced the whole time because the DDL is transactional),
* adds the ``campaign_deliveries.status`` index the model declares.

The model side of the same change adds the audit, survey-status, and SMTP
declarations that already existed in the database, so no data changes are needed.

Revision ID: 5d9c20dae573
Revises: c4d5e6f7a8b9
Create Date: 2026-10-15 14:48:51.109844

"""

from collections.abc import Sequence

from alembic import op

revision: str = "5d9c20dae573"
down_revision: str | Sequence[str] | None = "c4d5e6f7a8b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (old index name, new index name)
INDEX_RENAMES = [
    ("ix_clinics_name", "ix_workspaces_name"),
    ("ix_clinics_slug", "ix_workspaces_slug"),
    ("ix_clinics_logo_storage_key", "ix_workspaces_logo_storage_key"),
    ("ix_campaigns_clinic_id", "ix_campaigns_workspace_id"),
    ("ix_recipients_clinic_id", "ix_recipients_workspace_id"),
    ("ix_survey_version_clinics_clinic_id", "ix_survey_version_workspaces_workspace_id"),
    (
        "ix_survey_version_clinics_survey_version_id",
        "ix_survey_version_workspaces_survey_version_id",
    ),
    ("ix_audit_events_clinic_id", "ix_audit_events_workspace_id"),
]

# (table, column, existing UNIQUE constraint name, unique index name the model expects)
UNIQUE_CONSTRAINT_TO_INDEX = [
    (
        "campaign_deliveries",
        "campaign_recipient_id",
        "campaign_deliveries_campaign_recipient_id_key",
        "ix_campaign_deliveries_campaign_recipient_id",
    ),
    (
        "campaigns",
        "public_slug",
        "campaigns_public_slug_key",
        "ix_campaigns_public_slug",
    ),
    (
        "response_sessions",
        "response_id",
        "response_sessions_response_id_key",
        "ix_response_sessions_response_id",
    ),
    (
        "response_sessions",
        "token_hash",
        "response_sessions_token_hash_key",
        "ix_response_sessions_token_hash",
    ),
]


def upgrade() -> None:
    for old, new in INDEX_RENAMES:
        op.execute(f"ALTER INDEX IF EXISTS {old} RENAME TO {new}")

    for table, column, constraint, index in UNIQUE_CONSTRAINT_TO_INDEX:
        op.execute(f"CREATE UNIQUE INDEX {index} ON {table} ({column})")
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT {constraint}")

    # campaign_recipients.token_hash had both a UNIQUE constraint and a redundant plain
    # index that already carries the name the model expects for the unique index.
    op.execute("DROP INDEX ix_campaign_recipients_token_hash")
    op.execute("ALTER TABLE campaign_recipients DROP CONSTRAINT campaign_recipients_token_hash_key")
    op.execute(
        "CREATE UNIQUE INDEX ix_campaign_recipients_token_hash ON campaign_recipients (token_hash)"
    )

    op.execute("CREATE INDEX ix_campaign_deliveries_status ON campaign_deliveries (status)")


def downgrade() -> None:
    op.execute("DROP INDEX ix_campaign_deliveries_status")

    op.execute("DROP INDEX ix_campaign_recipients_token_hash")
    op.execute(
        "ALTER TABLE campaign_recipients "
        "ADD CONSTRAINT campaign_recipients_token_hash_key UNIQUE (token_hash)"
    )
    op.execute("CREATE INDEX ix_campaign_recipients_token_hash ON campaign_recipients (token_hash)")

    for table, column, constraint, index in reversed(UNIQUE_CONSTRAINT_TO_INDEX):
        op.execute(f"ALTER TABLE {table} ADD CONSTRAINT {constraint} UNIQUE ({column})")
        op.execute(f"DROP INDEX {index}")

    for old, new in reversed(INDEX_RENAMES):
        op.execute(f"ALTER INDEX IF EXISTS {new} RENAME TO {old}")
