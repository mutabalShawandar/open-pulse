from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.recipient import CampaignRecipientStatus, RecipientStatus


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if "@" not in email or email.count("@") != 1 or any(character in email for character in "\r\n"):
        raise ValueError("A valid email address is required")
    local, domain = email.rsplit("@", 1)
    if not local or not domain or "." not in domain:
        raise ValueError("A valid email address is required")
    return email


class RecipientCreateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=255)
    email: str = Field(max_length=320)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None


class RecipientImportRequest(BaseModel):
    recipients: list[RecipientCreateRequest] = Field(min_length=1, max_length=2_000)


class RecipientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    clinic_id: UUID
    display_name: str | None
    email: str
    status: RecipientStatus
    source: str
    opted_out_at: datetime | None
    created_at: datetime
    updated_at: datetime


class RecipientImportResponse(BaseModel):
    created_count: int
    duplicate_count: int
    recipients: list[RecipientResponse]


class CampaignRecipientAssignRequest(BaseModel):
    recipient_ids: list[UUID] = Field(min_length=1, max_length=2_000)


class CampaignRecipientResponse(BaseModel):
    id: UUID
    campaign_id: UUID
    recipient_id: UUID
    display_name: str | None
    email: str
    recipient_status: RecipientStatus
    status: CampaignRecipientStatus
    sent_at: datetime | None
    last_error: str | None
    created_at: datetime
