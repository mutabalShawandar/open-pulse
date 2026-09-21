from app.db.base import Base
from sqlalchemy import ForeignKey, String, DateTime, UniqueConstraint,  func
import uuid
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class Recipient(Base):
    __tablename__ = "recipients"
    __table_args__ = (
        UniqueConstraint(
            "clinic_id",
            "email",
            name="uq_recipient_email_clinic_id"
        )
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
    
    display_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=False,
        index=True
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )