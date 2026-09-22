"""add durable campaign deliveries"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = "1b2c3d4e5f6a"
down_revision = "2c3d4e5f6a7b"
branch_labels = None
depends_on = None
def upgrade() -> None:
    op.create_table("campaign_deliveries", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("campaign_recipient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaign_recipients.id", ondelete="CASCADE"), nullable=False, unique=True), sa.Column("status", sa.String(32), nullable=False, server_default="pending"), sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"), sa.Column("idempotency_key", sa.String(64), nullable=False, unique=True), sa.Column("last_error", sa.String(500)), sa.Column("queued_at", sa.DateTime(timezone=True)), sa.Column("sent_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
def downgrade() -> None: op.drop_table("campaign_deliveries")
