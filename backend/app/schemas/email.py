from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _valid_email(value: str) -> str:
    candidate = value.strip()
    if (
        "@" not in candidate
        or candidate.count("@") != 1
        or any(character in candidate for character in "\r\n")
    ):
        raise ValueError("A valid email address is required")
    local, domain = candidate.rsplit("@", 1)
    if not local or not domain or "." not in domain:
        raise ValueError("A valid email address is required")
    return candidate


class SmtpConfigurationUpsertRequest(BaseModel):
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    use_starttls: bool = True
    use_ssl: bool = False
    username: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=1, max_length=512)
    sender_name: str = Field(min_length=1, max_length=255)
    sender_email: str = Field(max_length=320)

    @field_validator("host", "sender_name")
    @classmethod
    def no_header_breaks(cls, value: str) -> str:
        value = value.strip()
        if "\r" in value or "\n" in value:
            raise ValueError("Line breaks are not permitted")
        return value

    @field_validator("sender_email")
    @classmethod
    def valid_sender_email(cls, value: str) -> str:
        return _valid_email(value)

    @model_validator(mode="after")
    def valid_transport(self):
        if self.use_ssl and self.use_starttls:
            raise ValueError("Use either implicit TLS or STARTTLS, not both")
        return self


class SmtpConfigurationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    host: str
    port: int
    use_starttls: bool
    use_ssl: bool
    username: str | None
    password_configured: bool
    sender_name: str
    sender_email: str
    created_at: datetime
    updated_at: datetime


class SmtpTestEmailRequest(BaseModel):
    recipient_email: str = Field(max_length=320)

    @field_validator("recipient_email")
    @classmethod
    def valid_recipient_email(cls, value: str) -> str:
        return _valid_email(value)


class CampaignEmailTemplateRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=255)
    html_body: str = Field(min_length=1, max_length=100_000)
    text_body: str = Field(min_length=1, max_length=100_000)
    sender_name: str | None = Field(default=None, max_length=255)
    reply_to: str | None = Field(default=None, max_length=320)

    @field_validator("reply_to")
    @classmethod
    def valid_reply_to(cls, value: str | None) -> str | None:
        return _valid_email(value) if value else None


class CampaignEmailTemplateResponse(CampaignEmailTemplateRequest):
    model_config = ConfigDict(from_attributes=True)
    campaign_id: UUID
    locked_at: datetime | None


class CampaignEmailTemplateTestRequest(BaseModel):
    recipient_email: str = Field(max_length=320)

    @field_validator("recipient_email")
    @classmethod
    def valid_recipient_email(cls, value: str) -> str:
        return _valid_email(value)


class CampaignDeliveryResponse(BaseModel):
    id: UUID
    recipient_id: UUID
    display_name: str | None
    email: str
    status: str
    attempt_count: int
    queued_at: datetime | None
    sent_at: datetime | None
    last_error: str | None


class CampaignDeliveryQueueResponse(BaseModel):
    queued_count: int
    skipped_count: int
