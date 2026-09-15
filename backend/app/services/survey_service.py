from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Survey,
    QuestionType,
    SurveyQuestion,
    SurveyQuestionOption,
    SurveyQuestionValidation,
    SurveySection,
    SurveyStatus,
    SurveyVersion,
    SurveyVersionClinic,
    SurveyVersionStatus,
)
from app.schemas.survey import (
    SurveyCreateRequest,
    SurveyQuestionCreateRequest,
    SurveyQuestionOptionCreateRequest,
    SurveyQuestionOptionUpdateRequest,
    SurveyQuestionUpdateRequest,
    SurveyQuestionValidationCreateRequest,
    SurveyQuestionValidationUpdateRequest,
    SurveyCopyRequest,
    SurveyDraftCreateRequest,
    SurveySectionCreateRequest,
    SurveySectionUpdateRequest,
    SurveyUpdateRequest,
)
from app.services.audit_service import add_audit_event


CHOICE_QUESTION_TYPES = {QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE}
VALIDATION_RULES = {
    QuestionType.RATING: {"min_value", "max_value", "step"},
    QuestionType.SHORT_TEXT: {"min_length", "max_length"},
    QuestionType.LONG_TEXT: {"min_length", "max_length"},
    QuestionType.NUMBER: {"min_value", "max_value"},
    QuestionType.DATE: {"min_date", "max_date"},
    QuestionType.MULTIPLE_CHOICE: {"min_selections", "max_selections"},
}


async def create_survey(
    session: AsyncSession,
    payload: SurveyCreateRequest,
    actor_user_id: UUID,
) -> tuple[Survey, SurveyVersion]:
    """Create an agency catalogue survey with one explicitly labelled draft."""
    survey = Survey(
        title=payload.title,
        description=payload.description,
        created_by_user_id=actor_user_id,
        status=SurveyStatus.DRAFT,
    )
    session.add(survey)

    try:
        await session.flush()
        draft = SurveyVersion(
            survey_id=survey.id,
            status=SurveyVersionStatus.DRAFT,
            draft_label=payload.initial_draft_label,
            created_by_user_id=actor_user_id,
        )
        session.add(draft)
        await session.flush()
        add_audit_event(
            session,
            actor_user_id=actor_user_id,
            clinic_id=None,
            action="survey.created",
            entity_type="survey",
            entity_id=survey.id,
            metadata={"draft_id": str(draft.id)},
        )
        await session.commit()
        await session.refresh(survey)
        await session.refresh(draft)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create survey",
        ) from error

    return survey, draft


async def list_surveys(session: AsyncSession, include_archived: bool = False) -> list[Survey]:
    statement = select(Survey).order_by(Survey.created_at.desc(), Survey.id.desc())
    if not include_archived:
        statement = statement.where(Survey.status != SurveyStatus.ARCHIVED)
    result = await session.scalars(statement)
    return list(result)


async def get_survey_or_404(session: AsyncSession, survey_id: UUID) -> Survey:
    survey = await session.scalar(select(Survey).where(Survey.id == survey_id))
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return survey


async def update_survey(
    session: AsyncSession,
    survey_id: UUID,
    payload: SurveyUpdateRequest,
    actor_user_id: UUID,
) -> Survey:
    survey = await get_survey_or_404(session, survey_id)
    if survey.status == SurveyStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived surveys cannot be updated")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(survey, field, value)
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        clinic_id=None,
        action="survey.updated",
        entity_type="survey",
        entity_id=survey.id,
        metadata={"changed_fields": sorted(payload.model_fields_set)},
    )
    await session.commit()
    await session.refresh(survey)
    return survey


async def archive_survey(session: AsyncSession, survey_id: UUID, actor_user_id: UUID) -> Survey:
    survey = await get_survey_or_404(session, survey_id)
    if survey.status == SurveyStatus.ARCHIVED:
        return survey
    survey.status = SurveyStatus.ARCHIVED
    survey.archived_at = datetime.now(UTC)
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        clinic_id=None,
        action="survey.archived",
        entity_type="survey",
        entity_id=survey.id,
    )
    await session.commit()
    await session.refresh(survey)
    return survey


async def restore_survey(session: AsyncSession, survey_id: UUID, actor_user_id: UUID) -> Survey:
    survey = await get_survey_or_404(session, survey_id)
    if survey.status != SurveyStatus.ARCHIVED:
        return survey
    has_published_version = await session.scalar(
        select(SurveyVersion.id).where(
            SurveyVersion.survey_id == survey.id,
            SurveyVersion.status == SurveyVersionStatus.PUBLISHED,
        ).limit(1)
    )
    survey.status = SurveyStatus.PUBLISHED if has_published_version else SurveyStatus.DRAFT
    survey.archived_at = None
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        clinic_id=None,
        action="survey.restored",
        entity_type="survey",
        entity_id=survey.id,
    )
    await session.commit()
    await session.refresh(survey)
    return survey


async def list_published_versions(session: AsyncSession, survey_id: UUID) -> list[SurveyVersion]:
    await get_survey_or_404(session, survey_id)
    result = await session.scalars(
        select(SurveyVersion)
        .where(
            SurveyVersion.survey_id == survey_id,
            SurveyVersion.status == SurveyVersionStatus.PUBLISHED,
        )
        .order_by(SurveyVersion.version_number.desc())
    )
    return list(result)


async def get_published_version_or_404(
    session: AsyncSession, survey_id: UUID, version_number: int
) -> SurveyVersion:
    version = await session.scalar(
        select(SurveyVersion).where(
            SurveyVersion.survey_id == survey_id,
            SurveyVersion.version_number == version_number,
            SurveyVersion.status == SurveyVersionStatus.PUBLISHED,
        )
    )
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Published version not found")
    return version


async def list_drafts(session: AsyncSession, survey_id: UUID) -> list[SurveyVersion]:
    result = await session.scalars(
        select(SurveyVersion)
        .where(
            SurveyVersion.survey_id == survey_id,
            SurveyVersion.status == SurveyVersionStatus.DRAFT,
        )
        .order_by(SurveyVersion.created_at.desc(), SurveyVersion.id.desc())
    )
    return list(result)


async def get_version_for_survey_or_404(
    session: AsyncSession, survey_id: UUID, version_id: UUID
) -> SurveyVersion:
    version = await session.scalar(
        select(SurveyVersion).where(
            SurveyVersion.id == version_id,
            SurveyVersion.survey_id == survey_id,
        )
    )
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey version not found")
    return version


async def _copy_version_content(
    session: AsyncSession,
    source_version_id: UUID,
    target_version_id: UUID,
) -> None:
    """Deep-copy a version hierarchy. All copied child rows receive new UUIDs."""
    sections = await list_sections(session, source_version_id)
    for source_section in sections:
        target_section = SurveySection(
            survey_version_id=target_version_id,
            title=source_section.title,
            description=source_section.description,
            position=source_section.position,
        )
        session.add(target_section)
        await session.flush()

        for source_question in await list_questions(session, source_section.id):
            target_question = SurveyQuestion(
                section_id=target_section.id,
                question_type=source_question.question_type,
                title=source_question.title,
                help_text=source_question.help_text,
                is_required=source_question.is_required,
                allow_other=source_question.allow_other,
                position=source_question.position,
            )
            session.add(target_question)
            await session.flush()

            for source_option in await list_options(session, source_question.id):
                session.add(
                    SurveyQuestionOption(
                        question_id=target_question.id,
                        label=source_option.label,
                        value=source_option.value,
                        position=source_option.position,
                    )
                )
            for source_validation in await list_validations(session, source_question.id):
                session.add(
                    SurveyQuestionValidation(
                        question_id=target_question.id,
                        rule_type=source_validation.rule_type,
                        rule_value=source_validation.rule_value.copy(),
                    )
                )


async def create_draft(
    session: AsyncSession,
    survey_id: UUID,
    payload: SurveyDraftCreateRequest,
    actor_user_id: UUID,
) -> SurveyVersion:
    await get_survey_or_404(session, survey_id)
    source_version = None
    if payload.source_version_id is not None:
        source_version = await get_version_for_survey_or_404(
            session, survey_id, payload.source_version_id
        )
    draft = SurveyVersion(
        survey_id=survey_id,
        status=SurveyVersionStatus.DRAFT,
        draft_label=payload.draft_label,
        based_on_version_id=source_version.id if source_version is not None else None,
        created_by_user_id=actor_user_id,
    )
    session.add(draft)
    try:
        await session.flush()
        if source_version is not None:
            await _copy_version_content(session, source_version.id, draft.id)
        add_audit_event(
            session,
            actor_user_id=actor_user_id,
            clinic_id=None,
            action="survey.draft_created",
            entity_type="survey_version",
            entity_id=draft.id,
            metadata={"survey_id": str(survey_id), "source_version_id": str(source_version.id) if source_version else None},
        )
        await session.commit()
        await session.refresh(draft)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not create draft") from error
    return draft


async def copy_survey(
    session: AsyncSession,
    source_survey_id: UUID,
    payload: SurveyCopyRequest,
    actor_user_id: UUID,
) -> tuple[Survey, SurveyVersion]:
    source_survey = await get_survey_or_404(session, source_survey_id)
    source_version = await get_version_for_survey_or_404(
        session, source_survey_id, payload.source_version_id
    )
    survey = Survey(
        title=payload.title or f"{source_survey.title} (Kopie)",
        description=payload.description if payload.description is not None else source_survey.description,
        status=SurveyStatus.DRAFT,
        created_by_user_id=actor_user_id,
    )
    session.add(survey)
    try:
        await session.flush()
        draft = SurveyVersion(
            survey_id=survey.id,
            status=SurveyVersionStatus.DRAFT,
            draft_label=f"Kopie von {source_version.version_number or source_version.draft_label or 'Entwurf'}",
            created_by_user_id=actor_user_id,
        )
        session.add(draft)
        await session.flush()
        await _copy_version_content(session, source_version.id, draft.id)
        add_audit_event(
            session,
            actor_user_id=actor_user_id,
            clinic_id=None,
            action="survey.copied",
            entity_type="survey",
            entity_id=survey.id,
            metadata={
                "source_survey_id": str(source_survey_id),
                "source_version_id": str(source_version.id),
                "draft_id": str(draft.id),
            },
        )
        await session.commit()
        await session.refresh(survey)
        await session.refresh(draft)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not copy survey") from error
    return survey, draft


async def _validate_draft_for_publication(session: AsyncSession, draft: SurveyVersion) -> tuple[int, int]:
    sections = await list_sections(session, draft.id)
    if not sections:
        raise HTTPException(status_code=422, detail="A published survey requires at least one section")

    question_count = 0
    for section in sections:
        if not section.title.strip():
            raise HTTPException(status_code=422, detail="Section titles cannot be empty")
        questions = await list_questions(session, section.id)
        if not questions:
            raise HTTPException(status_code=422, detail="Published surveys cannot contain empty sections")
        for question in questions:
            question_count += 1
            if not question.title.strip():
                raise HTTPException(status_code=422, detail="Question titles cannot be empty")
            options = await list_options(session, question.id)
            if question.question_type in CHOICE_QUESTION_TYPES:
                values = [option.value.strip() for option in options]
                if len(options) < 2 or not all(values) or len(set(values)) != len(values):
                    raise HTTPException(
                        status_code=422,
                        detail="Choice questions require at least two distinct non-empty options",
                    )
            elif options:
                raise HTTPException(
                    status_code=422,
                    detail=f"{question.question_type.value} questions cannot have options",
                )

            validations = await list_validations(session, question.id)
            validation_types = {validation.rule_type for validation in validations}
            if question.question_type == QuestionType.RATING and not {
                "min_value",
                "max_value",
            } <= validation_types:
                raise HTTPException(
                    status_code=422,
                    detail="Rating questions require min_value and max_value rules",
                )
            for validation in validations:
                _validate_rule_value(question, validation.rule_type, validation.rule_value)
                await _validate_rule_bounds(
                    session,
                    question,
                    validation.rule_type,
                    validation.rule_value,
                    validation.id,
                )
    return len(sections), question_count


async def publish_draft(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    actor_user_id: UUID,
) -> SurveyVersion:
    survey = await session.scalar(select(Survey).where(Survey.id == survey_id).with_for_update())
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if survey.status == SurveyStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived surveys cannot be published")
    draft = await session.scalar(
        select(SurveyVersion)
        .where(SurveyVersion.id == draft_id, SurveyVersion.survey_id == survey_id)
        .with_for_update()
    )
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    if draft.status != SurveyVersionStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Version is already published")

    section_count, question_count = await _validate_draft_for_publication(session, draft)
    latest_version = await session.scalar(
        select(func.max(SurveyVersion.version_number)).where(
            SurveyVersion.survey_id == survey_id,
            SurveyVersion.status == SurveyVersionStatus.PUBLISHED,
        )
    )
    draft.version_number = (latest_version or 0) + 1
    draft.status = SurveyVersionStatus.PUBLISHED
    draft.published_at = datetime.now(UTC)
    survey.status = SurveyStatus.PUBLISHED
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        clinic_id=None,
        action="survey.published",
        entity_type="survey_version",
        entity_id=draft.id,
        metadata={
            "survey_id": str(survey.id),
            "version_number": draft.version_number,
            "section_count": section_count,
            "question_count": question_count,
        },
    )
    try:
        await session.commit()
        await session.refresh(draft)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not publish draft") from error
    return draft


async def list_clinic_version_assignments(
    session: AsyncSession,
    clinic_id: UUID,
    actor,
) -> list[SurveyVersionClinic]:
    result = await session.scalars(
        select(SurveyVersionClinic)
        .where(
            SurveyVersionClinic.clinic_id == clinic_id,
            SurveyVersionClinic.unassigned_at.is_(None),
        )
        .order_by(SurveyVersionClinic.assigned_at.desc(), SurveyVersionClinic.id.desc())
    )
    return list(result)


async def assign_version_to_clinic(
    session: AsyncSession,
    clinic_id: UUID,
    survey_version_id: UUID,
    actor,
) -> SurveyVersionClinic:
    version = await session.scalar(select(SurveyVersion).where(SurveyVersion.id == survey_version_id))
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey version not found")
    if version.status != SurveyVersionStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Only published survey versions can be assigned to clinics",
        )
    survey = await get_survey_or_404(session, version.survey_id)
    if survey.status == SurveyStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived surveys cannot be assigned to clinics",
        )

    assignment = await session.scalar(
        select(SurveyVersionClinic)
        .where(
            SurveyVersionClinic.survey_version_id == survey_version_id,
            SurveyVersionClinic.clinic_id == clinic_id,
        )
        .order_by(SurveyVersionClinic.assigned_at.desc())
        .limit(1)
    )
    if assignment is not None and assignment.unassigned_at is None:
        return assignment
    if assignment is None:
        assignment = SurveyVersionClinic(
            survey_version_id=survey_version_id,
            clinic_id=clinic_id,
            assigned_by_user_id=actor.id,
        )
        session.add(assignment)
    else:
        assignment.assigned_by_user_id = actor.id
        assignment.assigned_at = datetime.now(UTC)
        assignment.unassigned_at = None

    try:
        await session.flush()
        add_audit_event(
            session,
            actor_user_id=actor.id,
            clinic_id=clinic_id,
            action="survey_version.assigned",
            entity_type="survey_version_clinic",
            entity_id=assignment.id,
            metadata={
                "survey_version_id": str(survey_version_id),
                "version_number": version.version_number,
            },
        )
        await session.commit()
        await session.refresh(assignment)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not assign survey version") from error
    return assignment


async def unassign_version_from_clinic(
    session: AsyncSession,
    clinic_id: UUID,
    survey_version_id: UUID,
    actor,
) -> None:
    assignment = await session.scalar(
        select(SurveyVersionClinic).where(
            SurveyVersionClinic.survey_version_id == survey_version_id,
            SurveyVersionClinic.clinic_id == clinic_id,
            SurveyVersionClinic.unassigned_at.is_(None),
        )
    )
    if assignment is None:
        return
    assignment.unassigned_at = datetime.now(UTC)
    add_audit_event(
        session,
        actor_user_id=actor.id,
        clinic_id=clinic_id,
        action="survey_version.unassigned",
        entity_type="survey_version_clinic",
        entity_id=assignment.id,
        metadata={"survey_version_id": str(survey_version_id)},
    )
    await session.commit()


async def get_draft_or_404(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
) -> SurveyVersion:
    draft = await session.scalar(select(SurveyVersion).where(SurveyVersion.id == draft_id))
    if draft is None or draft.survey_id != survey_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    if draft.status != SurveyVersionStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Published survey versions cannot be edited",
        )
    return draft


async def list_sections(session: AsyncSession, draft_id: UUID) -> list[SurveySection]:
    result = await session.scalars(
        select(SurveySection)
        .where(SurveySection.survey_version_id == draft_id)
        .order_by(SurveySection.position, SurveySection.id)
    )
    return list(result)


async def create_section(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    payload: SurveySectionCreateRequest,
) -> SurveySection:
    await get_draft_or_404(session, survey_id, draft_id)
    last_position = await session.scalar(
        select(func.max(SurveySection.position)).where(SurveySection.survey_version_id == draft_id)
    )
    section = SurveySection(
        survey_version_id=draft_id,
        title=payload.title,
        description=payload.description,
        position=0 if last_position is None else last_position + 1,
    )
    session.add(section)
    try:
        await session.commit()
        await session.refresh(section)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create survey section",
        ) from error
    return section


async def get_section_or_404(
    session: AsyncSession,
    draft_id: UUID,
    section_id: UUID,
) -> SurveySection:
    section = await session.scalar(
        select(SurveySection).where(
            SurveySection.id == section_id,
            SurveySection.survey_version_id == draft_id,
        )
    )
    if section is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey section not found")
    return section


async def update_section(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    payload: SurveySectionUpdateRequest,
) -> SurveySection:
    await get_draft_or_404(session, survey_id, draft_id)
    section = await get_section_or_404(session, draft_id, section_id)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(section, field, value)
    try:
        await session.commit()
        await session.refresh(section)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not update survey section",
        ) from error
    return section


async def delete_section(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
) -> None:
    await get_draft_or_404(session, survey_id, draft_id)
    section = await get_section_or_404(session, draft_id, section_id)
    await session.delete(section)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not delete survey section",
        ) from error


async def reorder_sections(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_ids: list[UUID],
) -> list[SurveySection]:
    await get_draft_or_404(session, survey_id, draft_id)
    sections = await list_sections(session, draft_id)
    existing_ids = {section.id for section in sections}
    requested_ids = set(section_ids)
    if len(section_ids) != len(requested_ids) or requested_ids != existing_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="section_ids must contain every draft section exactly once",
        )

    if not sections:
        return []

    # Shift every sibling first so the following assignments cannot violate the
    # immediate unique (survey_version_id, position) database constraint.
    await session.execute(
        update(SurveySection)
        .where(SurveySection.survey_version_id == draft_id)
        .values(position=SurveySection.position + len(sections))
    )
    sections_by_id = {section.id: section for section in sections}
    for position, section_id in enumerate(section_ids):
        sections_by_id[section_id].position = position

    try:
        await session.commit()
        return await list_sections(session, draft_id)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not reorder survey sections",
        ) from error


async def list_questions(session: AsyncSession, section_id: UUID) -> list[SurveyQuestion]:
    result = await session.scalars(
        select(SurveyQuestion)
        .where(SurveyQuestion.section_id == section_id)
        .order_by(SurveyQuestion.position, SurveyQuestion.id)
    )
    return list(result)


async def create_question(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    payload: SurveyQuestionCreateRequest,
) -> SurveyQuestion:
    await get_draft_or_404(session, survey_id, draft_id)
    await get_section_or_404(session, draft_id, section_id)
    if payload.allow_other and payload.question_type not in CHOICE_QUESTION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Only single_choice and multiple_choice questions support allow_other",
        )
    last_position = await session.scalar(
        select(func.max(SurveyQuestion.position)).where(SurveyQuestion.section_id == section_id)
    )
    question = SurveyQuestion(
        section_id=section_id,
        question_type=payload.question_type,
        title=payload.title,
        help_text=payload.help_text,
        is_required=payload.is_required,
        allow_other=payload.allow_other,
        position=0 if last_position is None else last_position + 1,
    )
    session.add(question)
    try:
        await session.commit()
        await session.refresh(question)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create survey question",
        ) from error
    return question


async def get_question_or_404(
    session: AsyncSession,
    section_id: UUID,
    question_id: UUID,
) -> SurveyQuestion:
    question = await session.scalar(
        select(SurveyQuestion).where(
            SurveyQuestion.id == question_id,
            SurveyQuestion.section_id == section_id,
        )
    )
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey question not found")
    return question


async def update_question(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
    payload: SurveyQuestionUpdateRequest,
) -> SurveyQuestion:
    await get_draft_or_404(session, survey_id, draft_id)
    await get_section_or_404(session, draft_id, section_id)
    question = await get_question_or_404(session, section_id, question_id)
    if payload.allow_other and question.question_type not in CHOICE_QUESTION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Only single_choice and multiple_choice questions support allow_other",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(question, field, value)
    try:
        await session.commit()
        await session.refresh(question)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not update survey question",
        ) from error
    return question


async def delete_question(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
) -> None:
    await get_draft_or_404(session, survey_id, draft_id)
    await get_section_or_404(session, draft_id, section_id)
    question = await get_question_or_404(session, section_id, question_id)
    await session.delete(question)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not delete survey question",
        ) from error


async def reorder_questions(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_ids: list[UUID],
) -> list[SurveyQuestion]:
    await get_draft_or_404(session, survey_id, draft_id)
    await get_section_or_404(session, draft_id, section_id)
    questions = await list_questions(session, section_id)
    existing_ids = {question.id for question in questions}
    requested_ids = set(question_ids)
    if len(question_ids) != len(requested_ids) or requested_ids != existing_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="question_ids must contain every section question exactly once",
        )

    if not questions:
        return []

    await session.execute(
        update(SurveyQuestion)
        .where(SurveyQuestion.section_id == section_id)
        .values(position=SurveyQuestion.position + len(questions))
    )
    questions_by_id = {question.id: question for question in questions}
    for position, question_id in enumerate(question_ids):
        questions_by_id[question_id].position = position

    try:
        await session.commit()
        return await list_questions(session, section_id)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not reorder survey questions",
        ) from error


async def _editable_question_or_404(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
) -> SurveyQuestion:
    await get_draft_or_404(session, survey_id, draft_id)
    await get_section_or_404(session, draft_id, section_id)
    return await get_question_or_404(session, section_id, question_id)


def _require_choice_question(question: SurveyQuestion) -> None:
    if question.question_type not in CHOICE_QUESTION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Only single_choice and multiple_choice questions support options",
        )


async def list_options(session: AsyncSession, question_id: UUID) -> list[SurveyQuestionOption]:
    result = await session.scalars(
        select(SurveyQuestionOption)
        .where(SurveyQuestionOption.question_id == question_id)
        .order_by(SurveyQuestionOption.position, SurveyQuestionOption.id)
    )
    return list(result)


async def create_option(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
    payload: SurveyQuestionOptionCreateRequest,
) -> SurveyQuestionOption:
    question = await _editable_question_or_404(
        session, survey_id, draft_id, section_id, question_id
    )
    _require_choice_question(question)
    last_position = await session.scalar(
        select(func.max(SurveyQuestionOption.position)).where(
            SurveyQuestionOption.question_id == question_id
        )
    )
    option = SurveyQuestionOption(
        question_id=question_id,
        label=payload.label,
        value=payload.value,
        position=0 if last_position is None else last_position + 1,
    )
    session.add(option)
    try:
        await session.commit()
        await session.refresh(option)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Option values must be unique within a question",
        ) from error
    return option


async def get_option_or_404(
    session: AsyncSession, question_id: UUID, option_id: UUID
) -> SurveyQuestionOption:
    option = await session.scalar(
        select(SurveyQuestionOption).where(
            SurveyQuestionOption.id == option_id,
            SurveyQuestionOption.question_id == question_id,
        )
    )
    if option is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey option not found")
    return option


async def update_option(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
    option_id: UUID,
    payload: SurveyQuestionOptionUpdateRequest,
) -> SurveyQuestionOption:
    question = await _editable_question_or_404(
        session, survey_id, draft_id, section_id, question_id
    )
    _require_choice_question(question)
    option = await get_option_or_404(session, question_id, option_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(option, field, value)
    try:
        await session.commit()
        await session.refresh(option)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Option values must be unique within a question",
        ) from error
    return option


async def delete_option(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
    option_id: UUID,
) -> None:
    question = await _editable_question_or_404(
        session, survey_id, draft_id, section_id, question_id
    )
    _require_choice_question(question)
    option = await get_option_or_404(session, question_id, option_id)
    await session.delete(option)
    await session.commit()


async def reorder_options(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
    option_ids: list[UUID],
) -> list[SurveyQuestionOption]:
    question = await _editable_question_or_404(
        session, survey_id, draft_id, section_id, question_id
    )
    _require_choice_question(question)
    options = await list_options(session, question_id)
    if len(option_ids) != len(set(option_ids)) or set(option_ids) != {option.id for option in options}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="option_ids must contain every question option exactly once",
        )
    if not options:
        return []
    await session.execute(
        update(SurveyQuestionOption)
        .where(SurveyQuestionOption.question_id == question_id)
        .values(position=SurveyQuestionOption.position + len(options))
    )
    options_by_id = {option.id: option for option in options}
    for position, option_id in enumerate(option_ids):
        options_by_id[option_id].position = position
    try:
        await session.commit()
        return await list_options(session, question_id)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not reorder options") from error


async def list_validations(
    session: AsyncSession, question_id: UUID
) -> list[SurveyQuestionValidation]:
    result = await session.scalars(
        select(SurveyQuestionValidation)
        .where(SurveyQuestionValidation.question_id == question_id)
        .order_by(SurveyQuestionValidation.rule_type)
    )
    return list(result)


def _rule_value_or_422(rule_value: dict[str, int | float | str]) -> int | float | str:
    if set(rule_value) != {"value"} or isinstance(rule_value["value"], bool):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="rule_value must contain exactly one non-boolean 'value'",
        )
    return rule_value["value"]


def _validate_rule_value(question: SurveyQuestion, rule_type: str, rule_value: dict) -> None:
    if rule_type not in VALIDATION_RULES.get(question.question_type, set()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Rule '{rule_type}' is not supported for {question.question_type.value}",
        )
    value = _rule_value_or_422(rule_value)
    integer_rules = {"min_length", "max_length", "min_selections", "max_selections"}
    numeric_rules = {"min_value", "max_value", "step"}
    date_rules = {"min_date", "max_date"}
    if rule_type in integer_rules and (not isinstance(value, int) or value < 0):
        raise HTTPException(status_code=422, detail=f"Rule '{rule_type}' requires a non-negative integer")
    if rule_type in numeric_rules and not isinstance(value, (int, float)):
        raise HTTPException(status_code=422, detail=f"Rule '{rule_type}' requires a number")
    if rule_type == "step" and value <= 0:
        raise HTTPException(status_code=422, detail="Rule 'step' must be greater than zero")
    if rule_type in date_rules:
        if not isinstance(value, str):
            raise HTTPException(status_code=422, detail=f"Rule '{rule_type}' requires an ISO date")
        try:
            date.fromisoformat(value)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=f"Rule '{rule_type}' requires an ISO date") from error


async def _validate_rule_bounds(
    session: AsyncSession,
    question: SurveyQuestion,
    rule_type: str,
    rule_value: dict,
    excluded_validation_id: UUID | None = None,
) -> None:
    rules = {rule.rule_type: rule.rule_value for rule in await list_validations(session, question.id)}
    if excluded_validation_id is not None:
        rules = {
            rule.rule_type: rule.rule_value
            for rule in await list_validations(session, question.id)
            if rule.id != excluded_validation_id
        }
    rules[rule_type] = rule_value
    pairs = [("min_length", "max_length"), ("min_selections", "max_selections"), ("min_value", "max_value"), ("min_date", "max_date")]
    for minimum, maximum in pairs:
        if minimum in rules and maximum in rules:
            minimum_value = _rule_value_or_422(rules[minimum])
            maximum_value = _rule_value_or_422(rules[maximum])
            if minimum.endswith("date"):
                minimum_value, maximum_value = date.fromisoformat(minimum_value), date.fromisoformat(maximum_value)
            if minimum_value > maximum_value:
                raise HTTPException(status_code=422, detail=f"{minimum} cannot exceed {maximum}")


async def create_validation(
    session: AsyncSession,
    survey_id: UUID,
    draft_id: UUID,
    section_id: UUID,
    question_id: UUID,
    payload: SurveyQuestionValidationCreateRequest,
) -> SurveyQuestionValidation:
    question = await _editable_question_or_404(session, survey_id, draft_id, section_id, question_id)
    _validate_rule_value(question, payload.rule_type, payload.rule_value)
    await _validate_rule_bounds(session, question, payload.rule_type, payload.rule_value)
    validation = SurveyQuestionValidation(
        question_id=question_id, rule_type=payload.rule_type, rule_value=payload.rule_value
    )
    session.add(validation)
    try:
        await session.commit()
        await session.refresh(validation)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status_code=409, detail="A rule of this type already exists") from error
    return validation


async def get_validation_or_404(
    session: AsyncSession, question_id: UUID, validation_id: UUID
) -> SurveyQuestionValidation:
    validation = await session.scalar(
        select(SurveyQuestionValidation).where(
            SurveyQuestionValidation.id == validation_id,
            SurveyQuestionValidation.question_id == question_id,
        )
    )
    if validation is None:
        raise HTTPException(status_code=404, detail="Survey validation rule not found")
    return validation


async def update_validation(
    session: AsyncSession, survey_id: UUID, draft_id: UUID, section_id: UUID,
    question_id: UUID, validation_id: UUID, payload: SurveyQuestionValidationUpdateRequest,
) -> SurveyQuestionValidation:
    question = await _editable_question_or_404(session, survey_id, draft_id, section_id, question_id)
    validation = await get_validation_or_404(session, question_id, validation_id)
    _validate_rule_value(question, validation.rule_type, payload.rule_value)
    await _validate_rule_bounds(session, question, validation.rule_type, payload.rule_value, validation.id)
    validation.rule_value = payload.rule_value
    await session.commit()
    await session.refresh(validation)
    return validation


async def delete_validation(
    session: AsyncSession, survey_id: UUID, draft_id: UUID, section_id: UUID,
    question_id: UUID, validation_id: UUID,
) -> None:
    await _editable_question_or_404(session, survey_id, draft_id, section_id, question_id)
    validation = await get_validation_or_404(session, question_id, validation_id)
    await session.delete(validation)
    await session.commit()
