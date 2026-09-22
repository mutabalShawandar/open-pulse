import enum

from app.db.base import Base
from sqlalchemy import Enum, ForeignKey, String, DateTime, UniqueConstraint, func
import uuid
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime


def _enum_values(enum_class: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_class]


class RecipientStatus(str, enum.Enum):
    ACTIVE = "active"
    OPTED_OUT = "opted_out"
    BOUNCED = "bounced"


class CampaignRecipientStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"
    BOUNCED = "bounced"
    COMPLETED = "completed"

class Recipient(Base):
    __tablename__ = "recipients"
    __table_args__ = (
        UniqueConstraint(
            "clinic_id",
            "email_normalized",
            name="uq_recipients_clinic_email_normalized"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clinics.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    display_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=False,
        index=True
    )

    email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
        unique=False,
        index=False
    )

    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False, index=True)

    status: Mapped[RecipientStatus] = mapped_column(
        Enum(RecipientStatus, name="recipient_status", values_callable=_enum_values),
        nullable=False,
        default=RecipientStatus.ACTIVE,
        server_default=RecipientStatus.ACTIVE.value,
        index=True,
    )

    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual", server_default="manual")

    opted_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"
    __table_args__ = (UniqueConstraint("campaign_id", "recipient_id", name="uq_campaign_recipients_campaign_recipient"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("recipients.id", ondelete="RESTRICT"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    status: Mapped[CampaignRecipientStatus] = mapped_column(Enum(CampaignRecipientStatus, name="campaign_recipient_status", values_callable=_enum_values), nullable=False, default=CampaignRecipientStatus.PENDING, server_default=CampaignRecipientStatus.PENDING.value, index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
