"""add clinic recipients

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    recipient_status = postgresql.ENUM(
        "active", "opted_out", "bounced", name="recipient_status", create_type=False
    )
    recipient_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "recipients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "clinic_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clinics.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("email_normalized", sa.String(length=320), nullable=False),
        sa.Column("status", recipient_status, nullable=False, server_default="active"),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="manual"),
        sa.Column("opted_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "clinic_id", "email_normalized", name="uq_recipients_clinic_email_normalized"
        ),
    )
    op.create_index("ix_recipients_clinic_id", "recipients", ["clinic_id"])
    op.create_index("ix_recipients_email_normalized", "recipients", ["email_normalized"])
    op.create_index("ix_recipients_status", "recipients", ["status"])


def downgrade() -> None:
    op.drop_table("recipients")
    sa.Enum(name="recipient_status").drop(op.get_bind(), checkfirst=True)
