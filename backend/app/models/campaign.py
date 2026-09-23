import enum
import hashlib
import secrets
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _enum_values(enum_class: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_class]


def generate_public_slug() -> str:
    """Generate an unguessable identifier for a public campaign URL."""
    return secrets.token_urlsafe(24)


def generate_response_token() -> str:
    """Generate a bearer token that is only ever persisted as a SHA-256 hash."""
    return secrets.token_urlsafe(32)


def hash_response_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ResponseIdentityMode(str, enum.Enum):
    ANONYMOUS = "anonymous"
    OPTIONAL_EMAIL = "optional_email"
    IDENTIFIED = "identified"


class ResponseStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Campaign(Base):
    """A clinic campaign permanently bound to one published survey version."""

    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint("starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at", name="ck_campaigns_valid_date_window"),
        Index("ix_campaigns_clinic_status", "clinic_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="RESTRICT"), nullable=False, index=True)
    survey_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("survey_versions.id", ondelete="RESTRICT"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    public_slug: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True, default=generate_public_slug)
    public_path: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True, index=True)
    status: Mapped[CampaignStatus] = mapped_column(Enum(CampaignStatus, name="campaign_status", values_callable=_enum_values), nullable=False, default=CampaignStatus.DRAFT, server_default=CampaignStatus.DRAFT.value, index=True)
    response_identity_mode: Mapped[ResponseIdentityMode] = mapped_column(Enum(ResponseIdentityMode, name="response_identity_mode", values_callable=_enum_values), nullable=False, default=ResponseIdentityMode.ANONYMOUS, server_default=ResponseIdentityMode.ANONYMOUS.value)
    branding: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SurveyResponse(Base):
    """One anonymous response. Identity is intentionally absent in Phase 3."""

    __tablename__ = "survey_responses"
    __table_args__ = (Index("ix_survey_responses_campaign_status", "campaign_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="RESTRICT"), nullable=False, index=True)
    survey_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("survey_versions.id", ondelete="RESTRICT"), nullable=False, index=True)
    status: Mapped[ResponseStatus] = mapped_column(Enum(ResponseStatus, name="response_status", values_callable=_enum_values), nullable=False, default=ResponseStatus.IN_PROGRESS, server_default=ResponseStatus.IN_PROGRESS.value)
    identity_mode_snapshot: Mapped[ResponseIdentityMode] = mapped_column(Enum(ResponseIdentityMode, name="response_identity_mode_snapshot", values_callable=_enum_values), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    legal_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ResponseSession(Base):
    """A resumable, expiring bearer session for one public response."""

    __tablename__ = "response_sessions"
    __table_args__ = (Index("ix_response_sessions_expires_at", "expires_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("survey_responses.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ResponseAnswer(Base):
    """A typed answer; selected options live in response_answer_options."""

    __tablename__ = "response_answers"
    __table_args__ = (
        UniqueConstraint("response_id", "question_id", name="uq_response_answers_response_question"),
        CheckConstraint("(text_value IS NOT NULL)::integer + (number_value IS NOT NULL)::integer + (date_value IS NOT NULL)::integer + (boolean_value IS NOT NULL)::integer <= 1", name="ck_response_answers_one_scalar_value"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("survey_responses.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("survey_questions.id", ondelete="RESTRICT"), nullable=False, index=True)
    text_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    number_value: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    date_value: Mapped[date | None] = mapped_column(Date, nullable=True)
    boolean_value: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    other_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ResponseAnswerOption(Base):
    __tablename__ = "response_answer_options"

    answer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("response_answers.id", ondelete="CASCADE"), primary_key=True)
    option_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("survey_question_options.id", ondelete="RESTRICT"), primary_key=True)
