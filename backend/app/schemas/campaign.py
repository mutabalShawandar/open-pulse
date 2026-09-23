from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.campaign import CampaignStatus, ResponseIdentityMode, ResponseStatus
from app.models.survey import QuestionType


def _require_timezone(value: datetime | None) -> datetime | None:
    if value is not None and (value.tzinfo is None or value.utcoffset() is None):
        raise ValueError("Campaign dates must include a timezone")
    return value


class CampaignCreateRequest(BaseModel):
    clinic_id: UUID
    survey_version_id: UUID
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)
    response_identity_mode: ResponseIdentityMode = ResponseIdentityMode.ANONYMOUS
    branding: dict | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        return _require_timezone(value)

    @model_validator(mode="after")
    def validate_window(self):
        if self.starts_at and self.ends_at and self.starts_at >= self.ends_at:
            raise ValueError("starts_at must be before ends_at")
        return self


class CampaignUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)
    survey_version_id: UUID | None = None
    branding: dict | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    status: CampaignStatus | None = None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        return _require_timezone(value)


class CampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    clinic_id: UUID
    survey_version_id: UUID
    survey_title: str
    survey_version_number: int
    title: str
    description: str | None
    public_slug: str
    public_path: str | None
    status: CampaignStatus
    response_identity_mode: ResponseIdentityMode
    branding: dict | None
    starts_at: datetime | None
    ends_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PublicOptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    label: str
    value: str
    position: int


class PublicQuestionResponse(BaseModel):
    id: UUID
    question_type: QuestionType
    title: str
    help_text: str | None
    is_required: bool
    allow_other: bool
    position: int
    options: list[PublicOptionResponse]
    validations: dict[str, dict]


class PublicSectionResponse(BaseModel):
    id: UUID
    title: str
    description: str | None
    position: int
    questions: list[PublicQuestionResponse]


class PublicCampaignResponse(BaseModel):
    title: str
    description: str | None
    clinic_name: str
    logo_url: str | None
    branding: dict | None
    response_identity_mode: ResponseIdentityMode
    sections: list[PublicSectionResponse]


class PublicResponseSessionRequest(BaseModel):
    pass


class PublicResponseSessionResponse(BaseModel):
    session_token: str
    expires_at: datetime


class PublicAnswerRequest(BaseModel):
    question_id: UUID
    text_value: str | None = Field(default=None, max_length=10_000)
    number_value: float | None = None
    date_value: date | None = None
    boolean_value: bool | None = None
    option_ids: list[UUID] = Field(default_factory=list, max_length=100)
    other_text: str | None = Field(default=None, max_length=10_000)


class PublicAnswerSaveRequest(BaseModel):
    answers: list[PublicAnswerRequest] = Field(min_length=1, max_length=100)


class PublicResponseStatusResponse(BaseModel):
    status: ResponseStatus
    completed_at: datetime | None


class PublicResponseCompletionRequest(BaseModel):
    legal_accepted: Literal[True]
