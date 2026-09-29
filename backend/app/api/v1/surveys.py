from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models import User
from app.schemas.survey import (
    SurveyCreateRequest,
    SurveyCopyRequest,
    SurveyDraftCreateRequest,
    SurveyDetailResponse,
    SurveyDraftSummaryResponse,
    SurveyVersionResponse,
    SurveyPublishedVersionDetailResponse,
    SurveyDraftDetailResponse,
    SurveyQuestionCreateRequest,
    SurveyQuestionDetailResponse,
    SurveyQuestionOptionCreateRequest,
    SurveyQuestionOptionReorderRequest,
    SurveyQuestionOptionResponse,
    SurveyQuestionOptionUpdateRequest,
    SurveyQuestionReorderRequest,
    SurveyQuestionResponse,
    SurveyQuestionUpdateRequest,
    SurveyQuestionValidationCreateRequest,
    SurveyQuestionValidationResponse,
    SurveyQuestionValidationUpdateRequest,
    SurveySectionCreateRequest,
    SurveySectionDetailResponse,
    SurveySectionReorderRequest,
    SurveySectionResponse,
    SurveySectionUpdateRequest,
    SurveySummaryResponse,
    SurveyUpdateRequest,
)
from app.services.authorization_service import require_organization_permission
from app.services.survey_service import (
    create_section,
    create_survey,
    create_draft,
    copy_survey,
    publish_draft,
    create_question,
    create_option,
    create_validation,
    delete_option,
    delete_question,
    delete_validation,
    delete_section,
    get_draft_or_404,
    get_published_version_or_404,
    get_option_or_404,
    get_question_or_404,
    get_section_or_404,
    get_survey_or_404,
    get_survey_organization_id_or_404,
    get_validation_or_404,
    list_sections,
    list_options,
    list_questions,
    list_validations,
    list_drafts,
    list_published_versions,
    list_surveys,
    reorder_sections,
    reorder_options,
    reorder_questions,
    update_option,
    update_question,
    update_validation,
    update_section,
    update_survey,
    archive_survey,
    restore_survey,
)


router = APIRouter(prefix="/api/v1/surveys", tags=["surveys"])


async def _require_survey_permission(
    session: AsyncSession, actor: User, survey_id: UUID, permission_name: str
) -> None:
    organization_id = await get_survey_organization_id_or_404(session, survey_id)
    await require_organization_permission(session, actor, organization_id, permission_name)


async def question_detail_response(
    session: AsyncSession, question
) -> SurveyQuestionDetailResponse:
    return SurveyQuestionDetailResponse(
        **SurveyQuestionResponse.model_validate(question, from_attributes=True).model_dump(),
        options=[
            SurveyQuestionOptionResponse.model_validate(option, from_attributes=True)
            for option in await list_options(session, question.id)
        ],
        validations=[
            SurveyQuestionValidationResponse.model_validate(validation, from_attributes=True)
            for validation in await list_validations(session, question.id)
        ],
    )


async def _editable_question_for_read(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
):
    await get_draft_or_404(session, survey_id, draft_id)
    await get_section_or_404(session, draft_id, section_id)
    return await get_question_or_404(session, section_id, question_id)


@router.post("", response_model=SurveyDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_survey_endpoint(
    payload: SurveyCreateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyDetailResponse:
    await require_organization_permission(session, actor, payload.organization_id, "survey.create")
    survey, draft = await create_survey(session, payload, actor.id)
    summary = SurveySummaryResponse.model_validate(survey, from_attributes=True)
    return SurveyDetailResponse(
        **summary.model_dump(),
        created_by_user_id=survey.created_by_user_id,
        drafts=[SurveyDraftSummaryResponse.model_validate(draft, from_attributes=True)],
    )


@router.get("", response_model=list[SurveySummaryResponse])
async def list_surveys_endpoint(
    _: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
    include_archived: bool = False,
) -> list[SurveySummaryResponse]:
    surveys = await list_surveys(session, include_archived=include_archived)
    return [SurveySummaryResponse.model_validate(survey, from_attributes=True) for survey in surveys]


@router.get("/{survey_id}", response_model=SurveyDetailResponse)
async def get_survey_endpoint(
    survey_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyDetailResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.read")
    survey = await get_survey_or_404(session, survey_id)
    drafts = await list_drafts(session, survey.id)
    summary = SurveySummaryResponse.model_validate(survey, from_attributes=True)
    return SurveyDetailResponse(
        **summary.model_dump(),
        created_by_user_id=survey.created_by_user_id,
        drafts=[SurveyDraftSummaryResponse.model_validate(draft, from_attributes=True) for draft in drafts],
    )


@router.patch("/{survey_id}", response_model=SurveySummaryResponse)
async def update_survey_endpoint(
    survey_id: UUID,
    payload: SurveyUpdateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveySummaryResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    survey = await update_survey(session, survey_id, payload, actor.id)
    return SurveySummaryResponse.model_validate(survey, from_attributes=True)


@router.post("/{survey_id}/archive", response_model=SurveySummaryResponse)
async def archive_survey_endpoint(
    survey_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveySummaryResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    survey = await archive_survey(session, survey_id, actor.id)
    return SurveySummaryResponse.model_validate(survey, from_attributes=True)


@router.post("/{survey_id}/restore", response_model=SurveySummaryResponse)
async def restore_survey_endpoint(
    survey_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveySummaryResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    survey = await restore_survey(session, survey_id, actor.id)
    return SurveySummaryResponse.model_validate(survey, from_attributes=True)


@router.get("/{survey_id}/versions", response_model=list[SurveyVersionResponse])
async def list_published_versions_endpoint(
    survey_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> list[SurveyVersionResponse]:
    await _require_survey_permission(session, actor, survey_id, "survey.read")
    return [
        SurveyVersionResponse.model_validate(version, from_attributes=True)
        for version in await list_published_versions(session, survey_id)
    ]


@router.get(
    "/{survey_id}/versions/{version_number}",
    response_model=SurveyPublishedVersionDetailResponse,
)
async def get_published_version_endpoint(
    survey_id: UUID,
    version_number: int,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyPublishedVersionDetailResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.read")
    version = await get_published_version_or_404(session, survey_id, version_number)
    summary = SurveyVersionResponse.model_validate(version, from_attributes=True)
    section_responses = []
    for section in await list_sections(session, version.id):
        section_responses.append(
            SurveySectionDetailResponse(
                **SurveySectionResponse.model_validate(section, from_attributes=True).model_dump(),
                questions=[
                    await question_detail_response(session, question)
                    for question in await list_questions(session, section.id)
                ],
            )
        )
    return SurveyPublishedVersionDetailResponse(
        **summary.model_dump(),
        sections=section_responses,
    )


@router.post("/{survey_id}/drafts", response_model=SurveyDraftSummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_draft_endpoint(
    survey_id: UUID,
    payload: SurveyDraftCreateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyDraftSummaryResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    draft = await create_draft(session, survey_id, payload, actor.id)
    return SurveyDraftSummaryResponse.model_validate(draft, from_attributes=True)


@router.post("/{survey_id}/copy", response_model=SurveyDetailResponse, status_code=status.HTTP_201_CREATED)
async def copy_survey_endpoint(
    survey_id: UUID,
    payload: SurveyCopyRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyDetailResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.create")
    survey, draft = await copy_survey(session, survey_id, payload, actor.id)
    summary = SurveySummaryResponse.model_validate(survey, from_attributes=True)
    return SurveyDetailResponse(
        **summary.model_dump(),
        created_by_user_id=survey.created_by_user_id,
        drafts=[SurveyDraftSummaryResponse.model_validate(draft, from_attributes=True)],
    )


@router.post(
    "/{survey_id}/drafts/{draft_id}/publish",
    response_model=SurveyVersionResponse,
)
async def publish_draft_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyVersionResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.publish")
    version = await publish_draft(session, survey_id, draft_id, actor.id)
    return SurveyVersionResponse.model_validate(version, from_attributes=True)


@router.get("/{survey_id}/drafts/{draft_id}", response_model=SurveyDraftDetailResponse)
async def get_draft_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyDraftDetailResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.read")
    draft = await get_draft_or_404(session, survey_id, draft_id)
    sections = await list_sections(session, draft.id)
    summary = SurveyDraftSummaryResponse.model_validate(draft, from_attributes=True)
    section_responses = []
    for section in sections:
        section_responses.append(
            SurveySectionDetailResponse(
                **SurveySectionResponse.model_validate(section, from_attributes=True).model_dump(),
                questions=[
                    await question_detail_response(session, question)
                    for question in await list_questions(session, section.id)
                ],
            )
        )
    return SurveyDraftDetailResponse(
        **summary.model_dump(),
        survey_id=draft.survey_id,
        sections=section_responses,
    )


@router.post(
    "/{survey_id}/drafts/{draft_id}/sections",
    response_model=SurveySectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_section_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    payload: SurveySectionCreateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveySectionResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    section = await create_section(session, survey_id, draft_id, payload)
    return SurveySectionResponse.model_validate(section, from_attributes=True)


@router.post(
    "/{survey_id}/drafts/{draft_id}/sections/reorder",
    response_model=list[SurveySectionResponse],
)
async def reorder_sections_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    payload: SurveySectionReorderRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> list[SurveySectionResponse]:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    sections = await reorder_sections(session, survey_id, draft_id, payload.section_ids)
    return [SurveySectionResponse.model_validate(section, from_attributes=True) for section in sections]


@router.patch(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}",
    response_model=SurveySectionResponse,
)
async def update_section_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    payload: SurveySectionUpdateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveySectionResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    section = await update_section(session, survey_id, draft_id, section_id, payload)
    return SurveySectionResponse.model_validate(section, from_attributes=True)


@router.delete(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_section_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    await delete_section(session, survey_id, draft_id, section_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions",
    response_model=SurveyQuestionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_question_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    payload: SurveyQuestionCreateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyQuestionResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    question = await create_question(session, survey_id, draft_id, section_id, payload)
    return SurveyQuestionResponse.model_validate(question, from_attributes=True)


@router.post(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/reorder",
    response_model=list[SurveyQuestionResponse],
)
async def reorder_questions_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    payload: SurveyQuestionReorderRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> list[SurveyQuestionResponse]:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    questions = await reorder_questions(
        session, survey_id, draft_id, section_id, payload.question_ids
    )
    return [SurveyQuestionResponse.model_validate(question, from_attributes=True) for question in questions]


@router.get(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}",
    response_model=SurveyQuestionResponse,
)
async def get_question_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyQuestionResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.read")
    await get_draft_or_404(session, survey_id, draft_id)
    await get_section_or_404(session, draft_id, section_id)
    question = await get_question_or_404(session, section_id, question_id)
    return SurveyQuestionResponse.model_validate(question, from_attributes=True)


@router.patch(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}",
    response_model=SurveyQuestionResponse,
)
async def update_question_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
    payload: SurveyQuestionUpdateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyQuestionResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    question = await update_question(
        session, survey_id, draft_id, section_id, question_id, payload
    )
    return SurveyQuestionResponse.model_validate(question, from_attributes=True)


@router.delete(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_question_endpoint(
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    await delete_question(session, survey_id, draft_id, section_id, question_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}/options",
    response_model=list[SurveyQuestionOptionResponse],
)
async def list_options_endpoint(
    survey_id: UUID, draft_id: UUID, section_id: UUID, question_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> list[SurveyQuestionOptionResponse]:
    await _require_survey_permission(session, actor, survey_id, "survey.read")
    await _editable_question_for_read(session, survey_id, draft_id, section_id, question_id)
    return [
        SurveyQuestionOptionResponse.model_validate(option, from_attributes=True)
        for option in await list_options(session, question_id)
    ]


@router.post(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}/options",
    response_model=SurveyQuestionOptionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_option_endpoint(
    survey_id: UUID, draft_id: UUID, section_id: UUID, question_id: UUID,
    payload: SurveyQuestionOptionCreateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyQuestionOptionResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    option = await create_option(session, survey_id, draft_id, section_id, question_id, payload)
    return SurveyQuestionOptionResponse.model_validate(option, from_attributes=True)


@router.post(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}/options/reorder",
    response_model=list[SurveyQuestionOptionResponse],
)
async def reorder_options_endpoint(
    survey_id: UUID, draft_id: UUID, section_id: UUID, question_id: UUID,
    payload: SurveyQuestionOptionReorderRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> list[SurveyQuestionOptionResponse]:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    options = await reorder_options(
        session, survey_id, draft_id, section_id, question_id, payload.option_ids
    )
    return [SurveyQuestionOptionResponse.model_validate(option, from_attributes=True) for option in options]


@router.patch(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}/options/{option_id}",
    response_model=SurveyQuestionOptionResponse,
)
async def update_option_endpoint(
    survey_id: UUID, draft_id: UUID, section_id: UUID, question_id: UUID, option_id: UUID,
    payload: SurveyQuestionOptionUpdateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyQuestionOptionResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    option = await update_option(
        session, survey_id, draft_id, section_id, question_id, option_id, payload
    )
    return SurveyQuestionOptionResponse.model_validate(option, from_attributes=True)


@router.delete(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}/options/{option_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_option_endpoint(
    survey_id: UUID, draft_id: UUID, section_id: UUID, question_id: UUID, option_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    await delete_option(session, survey_id, draft_id, section_id, question_id, option_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}/validations",
    response_model=list[SurveyQuestionValidationResponse],
)
async def list_validations_endpoint(
    survey_id: UUID, draft_id: UUID, section_id: UUID, question_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> list[SurveyQuestionValidationResponse]:
    await _require_survey_permission(session, actor, survey_id, "survey.read")
    await _editable_question_for_read(session, survey_id, draft_id, section_id, question_id)
    return [
        SurveyQuestionValidationResponse.model_validate(validation, from_attributes=True)
        for validation in await list_validations(session, question_id)
    ]


@router.post(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}/validations",
    response_model=SurveyQuestionValidationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_validation_endpoint(
    survey_id: UUID, draft_id: UUID, section_id: UUID, question_id: UUID,
    payload: SurveyQuestionValidationCreateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyQuestionValidationResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    validation = await create_validation(session, survey_id, draft_id, section_id, question_id, payload)
    return SurveyQuestionValidationResponse.model_validate(validation, from_attributes=True)


@router.patch(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}/validations/{validation_id}",
    response_model=SurveyQuestionValidationResponse,
)
async def update_validation_endpoint(
    survey_id: UUID, draft_id: UUID, section_id: UUID, question_id: UUID, validation_id: UUID,
    payload: SurveyQuestionValidationUpdateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyQuestionValidationResponse:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    validation = await update_validation(
        session, survey_id, draft_id, section_id, question_id, validation_id, payload
    )
    return SurveyQuestionValidationResponse.model_validate(validation, from_attributes=True)


@router.delete(
    "/{survey_id}/drafts/{draft_id}/sections/{section_id}/questions/{question_id}/validations/{validation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_validation_endpoint(
    survey_id: UUID, draft_id: UUID, section_id: UUID, question_id: UUID, validation_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    await _require_survey_permission(session, actor, survey_id, "survey.edit")
    await delete_validation(session, survey_id, draft_id, section_id, question_id, validation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
