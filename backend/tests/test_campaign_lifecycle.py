from datetime import UTC, datetime, timedelta
import asyncio
import unittest
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError

from app.models.campaign import Campaign, CampaignStatus
from app.models.survey import QuestionType, SurveyQuestion
from app.schemas.campaign import CampaignCreateRequest, PublicAnswerRequest, PublicResponseCompletionRequest
from app.services.campaign_service import _is_publicly_open, _validate_answer, campaign_has_ended


class CampaignLifecycleTests(unittest.TestCase):
    def test_end_date_closes_public_access_at_the_exact_time(self) -> None:
        now = datetime(2026, 9, 22, 12, tzinfo=UTC)
        campaign = Campaign(status=CampaignStatus.ACTIVE, ends_at=now)

        self.assertTrue(campaign_has_ended(campaign, now))
        self.assertFalse(_is_publicly_open(campaign, now))

    def test_future_end_date_keeps_an_active_campaign_open(self) -> None:
        now = datetime(2026, 9, 22, 12, tzinfo=UTC)
        campaign = Campaign(status=CampaignStatus.ACTIVE, ends_at=now + timedelta(seconds=1))

        self.assertFalse(campaign_has_ended(campaign, now))
        self.assertTrue(_is_publicly_open(campaign, now))

    def test_campaign_end_date_requires_a_timezone(self) -> None:
        with self.assertRaises(ValueError):
            CampaignCreateRequest(
                clinic_id="00000000-0000-0000-0000-000000000001",
                survey_version_id="00000000-0000-0000-0000-000000000002",
                title="Test",
                ends_at=datetime(2026, 9, 22, 12),
            )

    def test_response_completion_requires_legal_acceptance(self) -> None:
        self.assertTrue(PublicResponseCompletionRequest(legal_accepted=True).legal_accepted)
        with self.assertRaises(ValidationError):
            PublicResponseCompletionRequest(legal_accepted=False)

    def test_required_multiple_choice_rejects_an_empty_selection(self) -> None:
        question = SurveyQuestion(
            id=uuid4(),
            question_type=QuestionType.MULTIPLE_CHOICE,
            is_required=True,
        )
        answer = PublicAnswerRequest(question_id=question.id)

        with self.assertRaises(HTTPException) as error:
            asyncio.run(_validate_answer(None, question, answer))

        self.assertEqual(error.exception.status_code, 422)
