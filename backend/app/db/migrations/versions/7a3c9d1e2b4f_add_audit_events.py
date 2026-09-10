"""add audit events

Revision ID: 7a3c9d1e2b4f
Revises: 6f2b7c8d9e10
"""

from alembic import op
import sqlalchemy as sa


revision = "7a3c9d1e2b4f"
down_revision = "6f2b7c8d9e10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("actor_user_id", sa.UUID(), nullable=True),
        sa.Column("clinic_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.UUID(), nullable=True),
        sa.Column("request_id", sa.String(length=100), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"])
    op.create_index("ix_audit_events_actor_user_id", "audit_events", ["actor_user_id"])
    op.create_index("ix_audit_events_clinic_id", "audit_events", ["clinic_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_events_clinic_id", table_name="audit_events")
    op.drop_index("ix_audit_events_actor_user_id", table_name="audit_events")
    op.drop_index("ix_audit_events_created_at", table_name="audit_events")
    op.drop_table("audit_events")
