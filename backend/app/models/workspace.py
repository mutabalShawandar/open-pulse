import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=False, index=True)

    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    logo_url: Mapped[str | None] = mapped_column(
        String(2083),
        nullable=True,
    )

    street: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    hausnummer: Mapped[str | None] = mapped_column(
        Integer(),
        nullable=True,
    )
    city: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    postal_code: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    logo_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True, unique=True)
