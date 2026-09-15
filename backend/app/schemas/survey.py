from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.survey import QuestionType, SurveyStatus, SurveyVersionStatus


class SurveyCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)
    initial_draft_label: str | None = Field(default=None, min_length=1, max_length=255)


class SurveyDraftSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: SurveyVersionStatus
    draft_label: str | None
    based_on_version_id: UUID | None
    created_at: datetime
    updated_at: datetime


class SurveyVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    survey_id: UUID
    version_number: int | None
    status: SurveyVersionStatus
    draft_label: str | None
    based_on_version_id: UUID | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class SurveyVersionClinicAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    survey_version_id: UUID
    clinic_id: UUID
    assigned_by_user_id: UUID | None
    assigned_at: datetime
    unassigned_at: datetime | None


class SurveyDraftCreateRequest(BaseModel):
    draft_label: str | None = Field(default=None, min_length=1, max_length=255)
    source_version_id: UUID | None = None


class SurveyCopyRequest(BaseModel):
    source_version_id: UUID
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)


class SurveyUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)


class SurveySummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    status: SurveyStatus
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class SurveyDetailResponse(SurveySummaryResponse):
    created_by_user_id: UUID | None
    drafts: list[SurveyDraftSummaryResponse]


class SurveySectionCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)


class SurveySectionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)


class SurveySectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    survey_version_id: UUID
    title: str
    description: str | None
    position: int
    created_at: datetime
    updated_at: datetime


class SurveySectionReorderRequest(BaseModel):
    section_ids: list[UUID]


class SurveyQuestionCreateRequest(BaseModel):
    question_type: QuestionType
    title: str = Field(min_length=1, max_length=500)
    help_text: str | None = Field(default=None, max_length=10_000)
    is_required: bool = False
    allow_other: bool = False


class SurveyQuestionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    help_text: str | None = Field(default=None, max_length=10_000)
    is_required: bool | None = None
    allow_other: bool | None = None


class SurveyQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    section_id: UUID
    question_type: QuestionType
    title: str
    help_text: str | None
    is_required: bool
    allow_other: bool
    position: int
    created_at: datetime
    updated_at: datetime


class SurveyQuestionReorderRequest(BaseModel):
    question_ids: list[UUID]


class SurveyQuestionOptionCreateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=500)
    value: str = Field(min_length=1, max_length=255)


class SurveyQuestionOptionUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=500)
    value: str | None = Field(default=None, min_length=1, max_length=255)


class SurveyQuestionOptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question_id: UUID
    label: str
    value: str
    position: int


class SurveyQuestionOptionReorderRequest(BaseModel):
    option_ids: list[UUID]


class SurveyQuestionValidationCreateRequest(BaseModel):
    rule_type: str = Field(min_length=1, max_length=100)
    rule_value: dict[str, int | float | str]


class SurveyQuestionValidationUpdateRequest(BaseModel):
    rule_value: dict[str, int | float | str]


class SurveyQuestionValidationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question_id: UUID
    rule_type: str
    rule_value: dict


class SurveyQuestionDetailResponse(SurveyQuestionResponse):
    options: list[SurveyQuestionOptionResponse]
    validations: list[SurveyQuestionValidationResponse]


class SurveySectionDetailResponse(SurveySectionResponse):
    questions: list[SurveyQuestionDetailResponse]


class SurveyDraftDetailResponse(SurveyDraftSummaryResponse):
    survey_id: UUID
    sections: list[SurveySectionDetailResponse]


class SurveyPublishedVersionDetailResponse(SurveyVersionResponse):
    sections: list[SurveySectionDetailResponse]
