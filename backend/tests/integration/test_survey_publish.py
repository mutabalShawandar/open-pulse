import os
import unittest
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings
from app.models import (
    QuestionType,
    Survey,
    SurveyQuestion,
    SurveyQuestionOption,
    SurveySection,
    SurveyStatus,
    SurveyVersion,
    SurveyVersionStatus,
    User,
)
from app.services.survey_service import (
    archive_survey,
    get_published_version_or_404,
    list_published_versions,
    publish_draft,
    restore_survey,
)


@unittest.skipUnless(
    os.getenv("TEST_DATABASE_URL") or os.getenv("APP_ENV") == "test",
    "Set APP_ENV=test with .env.test to run PostgreSQL integration tests",
)
class SurveyPublishTests(unittest.IsolatedAsyncioTestCase):
    async def test_valid_draft_publishes_once_as_immutable_version(self) -> None:
        database_url = os.getenv("TEST_DATABASE_URL", settings.database_url)
        engine = create_async_engine(database_url)
        async with engine.connect() as connection:
            transaction = await connection.begin()
            session = AsyncSession(bind=connection, expire_on_commit=False)
            try:
                actor = User(
                    email=f"publish-{uuid4()}@example.test",
                    display_name="Publish Test",
                    is_active=True,
                )
                session.add(actor)
                await session.flush()
                survey = Survey(
                    title="Publishable survey",
                    status=SurveyStatus.DRAFT,
                    created_by_user_id=actor.id,
                )
                session.add(survey)
                await session.flush()
                draft = SurveyVersion(
                    survey_id=survey.id,
                    status=SurveyVersionStatus.DRAFT,
                    created_by_user_id=actor.id,
                )
                session.add(draft)
                await session.flush()
                section = SurveySection(survey_version_id=draft.id, title="Section", position=0)
                session.add(section)
                await session.flush()
                question = SurveyQuestion(
                    section_id=section.id,
                    question_type=QuestionType.SINGLE_CHOICE,
                    title="Would you recommend us?",
                    position=0,
                )
                session.add(question)
                await session.flush()
                session.add_all(
                    [
                        SurveyQuestionOption(
                            question_id=question.id, label="Yes", value="yes", position=0
                        ),
                        SurveyQuestionOption(
                            question_id=question.id, label="No", value="no", position=1
                        ),
                    ]
                )
                await session.flush()

                published = await publish_draft(session, survey.id, draft.id, actor.id)
                self.assertEqual(published.status, SurveyVersionStatus.PUBLISHED)
                self.assertEqual(published.version_number, 1)
                self.assertIsNotNone(published.published_at)
                self.assertEqual(survey.status, SurveyStatus.PUBLISHED)
                self.assertEqual(len(await list_published_versions(session, survey.id)), 1)
                retrieved = await get_published_version_or_404(session, survey.id, 1)
                self.assertEqual(retrieved.id, published.id)

                with self.assertRaises(HTTPException) as error:
                    await publish_draft(session, survey.id, draft.id, actor.id)
                self.assertEqual(error.exception.status_code, 409)

                archived = await archive_survey(session, survey.id, actor.id)
                self.assertEqual(archived.status, SurveyStatus.ARCHIVED)
                self.assertIsNotNone(archived.archived_at)
                restored = await restore_survey(session, survey.id, actor.id)
                self.assertEqual(restored.status, SurveyStatus.PUBLISHED)
                self.assertIsNone(restored.archived_at)
            finally:
                await session.close()
                await transaction.rollback()
        await engine.dispose()
