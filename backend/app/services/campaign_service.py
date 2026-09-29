from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Campaign, CampaignDelivery, CampaignRecipient, CampaignRecipientStatus, CampaignStatus, Workspace, QuestionType, ResponseAnswer, ResponseAnswerOption, ResponseSession, ResponseStatus, Survey, SurveyQuestion, SurveyQuestionOption, SurveyQuestionValidation, SurveyResponse, SurveySection, SurveyVersion, SurveyVersionWorkspace, SurveyVersionStatus
from app.models.campaign import generate_response_token, hash_response_token
from app.core.links import normalize_campaign_path
from app.schemas.campaign import CampaignCreateRequest, CampaignUpdateRequest, PublicAnswerRequest
from app.services.audit_service import add_audit_event


CHOICE_TYPES = {QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE}
TEXT_TYPES = {QuestionType.SHORT_TEXT, QuestionType.LONG_TEXT}


async def assign_public_path(session: AsyncSession, campaign: Campaign) -> str:
    """Assign a unique, human-readable public route without exposing the secure slug."""
    base = normalize_campaign_path(campaign.title)
    candidate = base
    suffix = 2
    while await session.scalar(select(Campaign.id).where(Campaign.public_path == candidate, Campaign.id != campaign.id).limit(1)):
        suffix_text = f"-{suffix}"
        candidate = f"{base[:128 - len(suffix_text)]}{suffix_text}"
        suffix += 1
    campaign.public_path = candidate
    return candidate


async def create_campaign(session: AsyncSession, payload: CampaignCreateRequest, actor_user_id: UUID) -> Campaign:
    if payload.response_identity_mode.value != "anonymous":
        raise HTTPException(status_code=422, detail="Only anonymous public responses are supported in Phase 3")
    workspace = await session.get(Workspace, payload.clinic_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Clinic not found")
    version = await session.get(SurveyVersion, payload.survey_version_id)
    if version is None or version.status != SurveyVersionStatus.PUBLISHED:
        raise HTTPException(status_code=422, detail="Campaigns require a published survey version")
    assignment = await session.scalar(select(SurveyVersionWorkspace.id).where(SurveyVersionWorkspace.workspace_id == workspace.id, SurveyVersionWorkspace.survey_version_id == version.id, SurveyVersionWorkspace.unassigned_at.is_(None)))
    if assignment is None:
        raise HTTPException(status_code=422, detail="The published survey version is not actively assigned to this clinic")
    campaign = Campaign(**payload.model_dump(exclude={"clinic_id"}), workspace_id=payload.clinic_id, created_by_user_id=actor_user_id)
    session.add(campaign)
    await session.flush()
    await assign_public_path(session, campaign)
    add_audit_event(session, actor_user_id=actor_user_id, workspace_id=campaign.workspace_id, action="campaign.created", entity_type="campaign", entity_id=campaign.id, metadata={"survey_version_id": str(campaign.survey_version_id)})
    await session.commit()
    await session.refresh(campaign)
    return campaign


async def list_campaigns(session: AsyncSession, clinic_id: UUID | None = None) -> list[Campaign]:
    query = select(Campaign).order_by(Campaign.created_at.desc())
    if clinic_id is not None:
        query = query.where(Campaign.workspace_id == clinic_id)
    return list(await session.scalars(query))


async def get_campaign_or_404(session: AsyncSession, campaign_id: UUID) -> Campaign:
    campaign = await session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


async def campaign_response_data(session: AsyncSession, campaign: Campaign) -> dict:
    version = await session.get(SurveyVersion, campaign.survey_version_id)
    survey = await session.get(Survey, version.survey_id) if version else None
    return {"id": campaign.id, "clinic_id": campaign.workspace_id, "survey_version_id": campaign.survey_version_id, "survey_title": survey.title if survey else "Unbekannte Umfrage", "survey_version_number": version.version_number if version and version.version_number else 0, "title": campaign.title, "description": campaign.description, "public_slug": campaign.public_slug, "public_path": campaign.public_path, "status": campaign.status, "response_identity_mode": campaign.response_identity_mode, "branding": campaign.branding, "starts_at": campaign.starts_at, "ends_at": campaign.ends_at, "created_at": campaign.created_at, "updated_at": campaign.updated_at}


async def delete_campaign(session: AsyncSession, campaign_id: UUID, actor_user_id: UUID) -> None:
    campaign = await get_campaign_or_404(session, campaign_id)
    if await session.scalar(select(SurveyResponse.id).where(SurveyResponse.campaign_id == campaign.id).limit(1)):
        raise HTTPException(status_code=409, detail="Campaigns with responses cannot be deleted; cancel the campaign instead")
    add_audit_event(session, actor_user_id=actor_user_id, workspace_id=campaign.workspace_id, action="campaign.deleted", entity_type="campaign", entity_id=campaign.id)
    await session.delete(campaign)
    await session.commit()


async def update_campaign(session: AsyncSession, campaign_id: UUID, payload: CampaignUpdateRequest, actor_user_id: UUID) -> Campaign:
    campaign = await get_campaign_or_404(session, campaign_id)
    if campaign.status in {CampaignStatus.COMPLETED, CampaignStatus.CANCELLED}:
        raise HTTPException(status_code=409, detail="Completed or cancelled campaigns cannot be changed")
    if payload.survey_version_id is not None and payload.survey_version_id != campaign.survey_version_id:
        if await session.scalar(select(SurveyResponse.id).where(SurveyResponse.campaign_id == campaign.id).limit(1)):
            raise HTTPException(status_code=409, detail="Cannot change the survey version after responses have been collected")
        version = await session.get(SurveyVersion, payload.survey_version_id)
        if version is None or version.status != SurveyVersionStatus.PUBLISHED:
            raise HTTPException(status_code=422, detail="Campaigns require a published survey version")
        assignment = await session.scalar(select(SurveyVersionWorkspace.id).where(SurveyVersionWorkspace.workspace_id == campaign.workspace_id, SurveyVersionWorkspace.survey_version_id == version.id, SurveyVersionWorkspace.unassigned_at.is_(None)))
        if assignment is None:
            raise HTTPException(status_code=422, detail="The published survey version is not actively assigned to this clinic")
    if payload.status in {CampaignStatus.DRAFT, CampaignStatus.SCHEDULED}:
        if await session.scalar(select(CampaignDelivery.id).join(CampaignRecipient).where(CampaignRecipient.campaign_id == campaign.id).limit(1)):
            raise HTTPException(status_code=409, detail="Cannot revert to draft/scheduled after sending has started")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    if payload.status == CampaignStatus.CANCELLED:
        queued_deliveries = list(await session.scalars(
            select(CampaignDelivery)
            .join(CampaignRecipient)
            .where(CampaignRecipient.campaign_id == campaign.id, CampaignDelivery.status.in_(["queued", "sending"]))
        ))
        for delivery in queued_deliveries:
            delivery.status = "failed"
            delivery.last_error = "Kampagne wurde abgebrochen"
            recipient = await session.get(CampaignRecipient, delivery.campaign_recipient_id)
            if recipient and recipient.status != CampaignRecipientStatus.SENT:
                recipient.status = CampaignRecipientStatus.FAILED
                recipient.last_error = delivery.last_error
    if campaign.starts_at and campaign.ends_at and campaign.starts_at >= campaign.ends_at:
        raise HTTPException(status_code=422, detail="starts_at must be before ends_at")
    add_audit_event(session, actor_user_id=actor_user_id, workspace_id=campaign.workspace_id, action="campaign.updated", entity_type="campaign", entity_id=campaign.id, metadata={"changed_fields": sorted(payload.model_fields_set)})
    await session.commit(); await session.refresh(campaign)
    return campaign


def campaign_has_ended(campaign: Campaign, now: datetime | None = None) -> bool:
    return campaign.ends_at is not None and campaign.ends_at <= (now or datetime.now(UTC))


def _is_publicly_open(campaign: Campaign, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    return campaign.status == CampaignStatus.ACTIVE and (campaign.starts_at is None or campaign.starts_at <= now) and (campaign.ends_at is None or now < campaign.ends_at)


async def complete_expired_campaigns(session: AsyncSession, now: datetime | None = None) -> int:
    """Close expired runnable campaigns and stop deliveries that have not been sent."""
    now = now or datetime.now(UTC)
    campaigns = list(await session.scalars(
        select(Campaign)
        .where(
            Campaign.status.in_([CampaignStatus.SCHEDULED, CampaignStatus.ACTIVE, CampaignStatus.PAUSED]),
            Campaign.ends_at.is_not(None),
            Campaign.ends_at <= now,
        )
        .with_for_update(skip_locked=True)
    ))
    for campaign in campaigns:
        campaign.status = CampaignStatus.COMPLETED
        deliveries = list(await session.scalars(
            select(CampaignDelivery)
            .join(CampaignRecipient)
            .where(
                CampaignRecipient.campaign_id == campaign.id,
                CampaignDelivery.status.in_(["queued", "sending"]),
            )
            .with_for_update(skip_locked=True)
        ))
        for delivery in deliveries:
            delivery.status = "failed"
            delivery.last_error = "Kampagne ist beendet"
            recipient = await session.get(CampaignRecipient, delivery.campaign_recipient_id)
            if recipient and recipient.status != CampaignRecipientStatus.SENT:
                recipient.status = CampaignRecipientStatus.FAILED
                recipient.last_error = delivery.last_error
        add_audit_event(session, actor_user_id=None, workspace_id=campaign.workspace_id, action="campaign.auto_completed", entity_type="campaign", entity_id=campaign.id, metadata={"ends_at": campaign.ends_at.isoformat()})
    if campaigns:
        await session.commit()
    return len(campaigns)


async def get_public_campaign(session: AsyncSession, slug: str) -> Campaign:
    campaign = await session.scalar(select(Campaign).where(or_(Campaign.public_path == slug, Campaign.public_slug == slug)))
    if campaign is None or not _is_publicly_open(campaign):
        raise HTTPException(status_code=404, detail="Campaign not available")
    return campaign


async def public_campaign_sections(session: AsyncSession, campaign: Campaign) -> list[dict]:
    sections = list(await session.scalars(select(SurveySection).where(SurveySection.survey_version_id == campaign.survey_version_id).order_by(SurveySection.position)))
    result = []
    for section in sections:
        questions = list(await session.scalars(select(SurveyQuestion).where(SurveyQuestion.section_id == section.id).order_by(SurveyQuestion.position)))
        public_questions = []
        for question in questions:
            options = list(await session.scalars(select(SurveyQuestionOption).where(SurveyQuestionOption.question_id == question.id).order_by(SurveyQuestionOption.position)))
            validations = list(await session.scalars(select(SurveyQuestionValidation).where(SurveyQuestionValidation.question_id == question.id)))
            public_questions.append({"id": question.id, "question_type": question.question_type, "title": question.title, "help_text": question.help_text, "is_required": question.is_required, "allow_other": question.allow_other, "position": question.position, "options": options, "validations": {rule.rule_type: rule.rule_value for rule in validations}})
        result.append({"id": section.id, "title": section.title, "description": section.description, "position": section.position, "questions": public_questions})
    return result


async def start_public_response(session: AsyncSession, campaign: Campaign) -> tuple[str, ResponseSession]:
    token = generate_response_token()
    response = SurveyResponse(campaign_id=campaign.id, survey_version_id=campaign.survey_version_id, identity_mode_snapshot=campaign.response_identity_mode)
    session.add(response); await session.flush()
    response_session = ResponseSession(response_id=response.id, token_hash=hash_response_token(token), expires_at=datetime.now(UTC) + timedelta(days=30))
    session.add(response_session)
    add_audit_event(session, actor_user_id=None, workspace_id=campaign.workspace_id, action="response.started", entity_type="survey_response", entity_id=response.id, metadata={"campaign_id": str(campaign.id)})
    await session.commit(); await session.refresh(response_session)
    return token, response_session


async def session_response_or_404(session: AsyncSession, token: str) -> SurveyResponse:
    response_session = await session.scalar(select(ResponseSession).where(ResponseSession.token_hash == hash_response_token(token)))
    if response_session is None or response_session.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=404, detail="Response session not available")
    response_session.last_seen_at = datetime.now(UTC)
    response = await session.get(SurveyResponse, response_session.response_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Response session not available")
    campaign = await session.get(Campaign, response.campaign_id)
    if campaign is None or not _is_publicly_open(campaign):
        raise HTTPException(status_code=404, detail="Response session not available")
    return response


async def _question_for_response(session: AsyncSession, response: SurveyResponse, question_id: UUID) -> SurveyQuestion:
    question = await session.scalar(select(SurveyQuestion).join(SurveySection).where(SurveyQuestion.id == question_id, SurveySection.survey_version_id == response.survey_version_id))
    if question is None:
        raise HTTPException(status_code=422, detail="Question does not belong to this survey")
    return question


async def _validate_answer(session: AsyncSession, question: SurveyQuestion, answer: PublicAnswerRequest) -> None:
    scalar_values = [answer.text_value is not None, answer.number_value is not None, answer.date_value is not None, answer.boolean_value is not None]
    if sum(scalar_values) > 1 or len(set(answer.option_ids)) != len(answer.option_ids):
        raise HTTPException(status_code=422, detail="Invalid answer value")
    if question.question_type in TEXT_TYPES:
        if answer.text_value is None or answer.option_ids or answer.number_value is not None or answer.date_value is not None or answer.boolean_value is not None:
            raise HTTPException(status_code=422, detail="Text question requires text_value")
    elif question.question_type in {QuestionType.NUMBER, QuestionType.RATING}:
        if answer.number_value is None or answer.text_value is not None or answer.option_ids:
            raise HTTPException(status_code=422, detail="Numeric question requires number_value")
    elif question.question_type == QuestionType.DATE:
        if answer.date_value is None or answer.text_value is not None or answer.option_ids:
            raise HTTPException(status_code=422, detail="Date question requires date_value")
    elif question.question_type == QuestionType.YES_NO:
        if answer.boolean_value is None or answer.text_value is not None or answer.option_ids:
            raise HTTPException(status_code=422, detail="Yes/no question requires boolean_value")
    elif question.question_type in CHOICE_TYPES:
        has_other_answer = bool(answer.other_text and answer.other_text.strip())
        has_selection = bool(answer.option_ids) or has_other_answer
        if (question.is_required and not has_selection) or answer.text_value is not None or answer.number_value is not None or answer.date_value is not None or answer.boolean_value is not None:
            raise HTTPException(status_code=422, detail="Choice question requires selected options")
        option_count = await session.scalar(select(func.count(SurveyQuestionOption.id)).where(SurveyQuestionOption.question_id == question.id, SurveyQuestionOption.id.in_(answer.option_ids)))
        if option_count != len(answer.option_ids):
            raise HTTPException(status_code=422, detail="Selected option does not belong to question")
    if answer.other_text and not question.allow_other:
        raise HTTPException(status_code=422, detail="This question does not allow an other answer")
    rules = {
        rule.rule_type: rule.rule_value.get("value")
        for rule in await session.scalars(select(SurveyQuestionValidation).where(SurveyQuestionValidation.question_id == question.id))
    }
    if answer.text_value is not None:
        if "min_length" in rules and len(answer.text_value) < rules["min_length"]:
            raise HTTPException(status_code=422, detail="Text answer is shorter than permitted")
        if "max_length" in rules and len(answer.text_value) > rules["max_length"]:
            raise HTTPException(status_code=422, detail="Text answer is longer than permitted")
    if answer.number_value is not None:
        if "min_value" in rules and answer.number_value < rules["min_value"]:
            raise HTTPException(status_code=422, detail="Numeric answer is below the permitted range")
        if "max_value" in rules and answer.number_value > rules["max_value"]:
            raise HTTPException(status_code=422, detail="Numeric answer is above the permitted range")
    if answer.date_value is not None:
        if "min_date" in rules and answer.date_value < date.fromisoformat(rules["min_date"]):
            raise HTTPException(status_code=422, detail="Date answer is before the permitted range")
        if "max_date" in rules and answer.date_value > date.fromisoformat(rules["max_date"]):
            raise HTTPException(status_code=422, detail="Date answer is after the permitted range")
    if question.question_type == QuestionType.MULTIPLE_CHOICE:
        selection_count = len(answer.option_ids) + (1 if answer.other_text and answer.other_text.strip() else 0)
        if "min_selections" in rules and selection_count < rules["min_selections"]:
            raise HTTPException(status_code=422, detail="Too few options selected")
        if "max_selections" in rules and selection_count > rules["max_selections"]:
            raise HTTPException(status_code=422, detail="Too many options selected")


async def save_answers(session: AsyncSession, response: SurveyResponse, answers: list[PublicAnswerRequest]) -> None:
    if response.status == ResponseStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="Response is already completed")
    if len({answer.question_id for answer in answers}) != len(answers):
        raise HTTPException(status_code=422, detail="Each question can only be supplied once")
    for payload in answers:
        question = await _question_for_response(session, response, payload.question_id)
        await _validate_answer(session, question, payload)
        answer = await session.scalar(select(ResponseAnswer).where(ResponseAnswer.response_id == response.id, ResponseAnswer.question_id == question.id))
        if answer is None:
            answer = ResponseAnswer(response_id=response.id, question_id=question.id)
            session.add(answer); await session.flush()
        answer.text_value, answer.number_value, answer.date_value, answer.boolean_value, answer.other_text = payload.text_value, payload.number_value, payload.date_value, payload.boolean_value, payload.other_text
        await session.execute(ResponseAnswerOption.__table__.delete().where(ResponseAnswerOption.answer_id == answer.id))
        for option_id in payload.option_ids:
            session.add(ResponseAnswerOption(answer_id=answer.id, option_id=option_id))
    await session.commit()


async def complete_response(session: AsyncSession, response: SurveyResponse) -> SurveyResponse:
    if response.status == ResponseStatus.COMPLETED:
        return response
    required_questions = list(await session.scalars(select(SurveyQuestion).join(SurveySection).where(SurveySection.survey_version_id == response.survey_version_id, SurveyQuestion.is_required.is_(True))))
    answered_ids = set(await session.scalars(select(ResponseAnswer.question_id).where(ResponseAnswer.response_id == response.id)))
    missing = {question.id for question in required_questions} - answered_ids
    # Reject legacy/incomplete choice rows too; an answer row alone is not an answer.
    for question in required_questions:
        if question.question_type not in CHOICE_TYPES or question.id in missing:
            continue
        answer = await session.scalar(select(ResponseAnswer).where(ResponseAnswer.response_id == response.id, ResponseAnswer.question_id == question.id))
        option_count = await session.scalar(select(func.count(ResponseAnswerOption.option_id)).where(ResponseAnswerOption.answer_id == answer.id)) if answer else 0
        if not option_count and not (answer and answer.other_text and answer.other_text.strip()):
            missing.add(question.id)
    if missing:
        raise HTTPException(status_code=422, detail="Required questions are missing", headers={"X-Missing-Question-Count": str(len(missing))})
    response.status = ResponseStatus.COMPLETED; response.completed_at = datetime.now(UTC); response.legal_accepted_at = response.completed_at
    campaign = await session.get(Campaign, response.campaign_id)
    add_audit_event(session, actor_user_id=None, workspace_id=campaign.workspace_id if campaign else None, action="response.completed", entity_type="survey_response", entity_id=response.id, metadata={"campaign_id": str(response.campaign_id)})
    await session.commit(); await session.refresh(response)
    return response
