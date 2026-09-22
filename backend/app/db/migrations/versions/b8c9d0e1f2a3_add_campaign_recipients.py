"""add campaign recipients

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    state = postgresql.ENUM("pending", "queued", "sent", "failed", "bounced", "completed", name="campaign_recipient_status", create_type=False)
    state.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "campaign_recipients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("status", state, nullable=False, server_default="pending"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("campaign_id", "recipient_id", name="uq_campaign_recipients_campaign_recipient"),
    )
    op.create_index("ix_campaign_recipients_campaign_id", "campaign_recipients", ["campaign_id"])
    op.create_index("ix_campaign_recipients_recipient_id", "campaign_recipients", ["recipient_id"])
    op.create_index("ix_campaign_recipients_token_hash", "campaign_recipients", ["token_hash"])
    op.create_index("ix_campaign_recipients_status", "campaign_recipients", ["status"])


def downgrade() -> None:
    op.drop_table("campaign_recipients")
    sa.Enum(name="campaign_recipient_status").drop(op.get_bind(), checkfirst=True)
