import os
import unittest
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings
from app.models import (
    QuestionType,
    Survey,
    SurveyQuestion,
    SurveyQuestionOption,
    SurveyQuestionValidation,
    SurveySection,
    SurveyStatus,
    SurveyVersion,
    SurveyVersionStatus,
    User,
)
from app.schemas.survey import SurveyCopyRequest, SurveyDraftCreateRequest
from app.services.survey_service import (
    copy_survey,
    create_draft,
    list_options,
    list_questions,
    list_sections,
    list_validations,
)


@unittest.skipUnless(
    os.getenv("TEST_DATABASE_URL") or os.getenv("APP_ENV") == "test",
    "Set APP_ENV=test with .env.test to run PostgreSQL integration tests",
)
class SurveyCopyTests(unittest.IsolatedAsyncioTestCase):
    async def test_draft_and_survey_copies_are_deep_and_independent(self) -> None:
        database_url = os.getenv("TEST_DATABASE_URL", settings.database_url)
        engine = create_async_engine(database_url)
        async with engine.connect() as connection:
            transaction = await connection.begin()
            session = AsyncSession(bind=connection, expire_on_commit=False)
            try:
                actor = User(
                    email=f"copy-{uuid4()}@example.test",
                    display_name="Copy Test",
                    is_active=True,
                )
                source_survey = Survey(
                    title="Source survey",
                    status=SurveyStatus.DRAFT,
                    created_by_user_id=actor.id,
                )
                session.add_all([actor, source_survey])
                await session.flush()
                source_survey.created_by_user_id = actor.id
                source_version = SurveyVersion(
                    survey_id=source_survey.id,
                    status=SurveyVersionStatus.DRAFT,
                    draft_label="Source draft",
                    created_by_user_id=actor.id,
                )
                session.add(source_version)
                await session.flush()
                source_section = SurveySection(
                    survey_version_id=source_version.id,
                    title="Section",
                    position=0,
                )
                session.add(source_section)
                await session.flush()
                source_question = SurveyQuestion(
                    section_id=source_section.id,
                    question_type=QuestionType.SINGLE_CHOICE,
                    title="Question",
                    position=0,
                )
                session.add(source_question)
                await session.flush()
                source_option = SurveyQuestionOption(
                    question_id=source_question.id,
                    label="Yes",
                    value="yes",
                    position=0,
                )
                source_validation = SurveyQuestionValidation(
                    question_id=source_question.id,
                    rule_type="min_selections",
                    rule_value={"value": 1},
                )
                session.add_all([source_option, source_validation])
                await session.flush()

                copied_draft = await create_draft(
                    session,
                    source_survey.id,
                    SurveyDraftCreateRequest(
                        draft_label="Adapted draft",
                        source_version_id=source_version.id,
                    ),
                    actor.id,
                )
                copied_section = (await list_sections(session, copied_draft.id))[0]
                copied_question = (await list_questions(session, copied_section.id))[0]
                copied_option = (await list_options(session, copied_question.id))[0]
                copied_validation = (await list_validations(session, copied_question.id))[0]

                self.assertNotEqual(copied_draft.id, source_version.id)
                self.assertNotEqual(copied_section.id, source_section.id)
                self.assertNotEqual(copied_question.id, source_question.id)
                self.assertNotEqual(copied_option.id, source_option.id)
                self.assertNotEqual(copied_validation.id, source_validation.id)
                self.assertEqual(copied_draft.based_on_version_id, source_version.id)
                self.assertEqual(copied_option.value, "yes")

                copied_survey, copied_survey_draft = await copy_survey(
                    session,
                    source_survey.id,
                    SurveyCopyRequest(source_version_id=source_version.id),
                    actor.id,
                )
                copied_survey_section = (await list_sections(session, copied_survey_draft.id))[0]
                self.assertNotEqual(copied_survey.id, source_survey.id)
                self.assertNotEqual(copied_survey_section.id, source_section.id)
                self.assertIsNone(copied_survey_draft.based_on_version_id)
            finally:
                await session.close()
                await transaction.rollback()
        await engine.dispose()
