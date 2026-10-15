import unittest
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException

from app.models import (
    ResponseAnswer,
    ResponseAnswerOption,
    ResponseIdentityMode,
    ResponseStatus,
    SurveyResponse,
)
from app.services.analytics_service import campaign_analytics
from tests.integration.db import requires_database, rolled_back_session
from tests.integration.factories import (
    SurveyFixture,
    make_campaign,
    make_published_survey,
    make_workspace,
)


async def add_response(
    session,
    campaign,
    fixture: SurveyFixture,
    *,
    rating=None,
    choice=None,
    yes_no=None,
    comment=None,
    status: ResponseStatus = ResponseStatus.COMPLETED,
) -> SurveyResponse:
    response = SurveyResponse(
        campaign_id=campaign.id,
        survey_version_id=fixture.version.id,
        status=status,
        identity_mode_snapshot=ResponseIdentityMode.ANONYMOUS,
        completed_at=datetime.now(UTC) if status == ResponseStatus.COMPLETED else None,
    )
    session.add(response)
    await session.flush()
    if rating is not None:
        session.add(
            ResponseAnswer(
                response_id=response.id,
                question_id=fixture.questions["rating"].id,
                number_value=rating,
            )
        )
    if choice is not None:
        answer = ResponseAnswer(response_id=response.id, question_id=fixture.questions["choice"].id)
        session.add(answer)
        await session.flush()
        session.add(ResponseAnswerOption(answer_id=answer.id, option_id=fixture.options[choice].id))
    if yes_no is not None:
        session.add(
            ResponseAnswer(
                response_id=response.id,
                question_id=fixture.questions["yes_no"].id,
                boolean_value=yes_no,
            )
        )
    if comment is not None:
        session.add(
            ResponseAnswer(
                response_id=response.id,
                question_id=fixture.questions["comment"].id,
                text_value=comment,
            )
        )
    await session.flush()
    return response


def question_result(analytics: dict, title: str) -> dict:
    (result,) = [item for item in analytics["questions"] if item["title"] == title]
    return result


@requires_database
class CampaignAnalyticsTests(unittest.IsolatedAsyncioTestCase):
    async def test_campaign_without_responses_reports_zero_and_no_statistics(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            analytics = await campaign_analytics(session, fixture.workspace.id, campaign.id)
            self.assertEqual((analytics["started_count"], analytics["completed_count"]), (0, 0))
            self.assertEqual(analytics["campaign_title"], campaign.title)
            rating = question_result(analytics, "rating")
            self.assertEqual(rating["answer_count"], 0)
            for statistic in ("average", "median", "minimum", "maximum"):
                self.assertIsNone(rating[statistic])
            self.assertEqual(rating["distribution"], [])
            self.assertEqual(rating["text_answers"], [])

    async def test_questions_are_returned_in_survey_order(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            analytics = await campaign_analytics(session, fixture.workspace.id, campaign.id)
            self.assertEqual(
                [item["title"] for item in analytics["questions"]],
                ["rating", "choice", "yes_no", "comment"],
            )

    async def test_numeric_statistics_use_completed_responses_only(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            for value in (5, 4, 4, 2):
                await add_response(session, campaign, fixture, rating=value)
            await add_response(
                session, campaign, fixture, rating=1, status=ResponseStatus.IN_PROGRESS
            )
            analytics = await campaign_analytics(session, fixture.workspace.id, campaign.id)
            self.assertEqual((analytics["started_count"], analytics["completed_count"]), (5, 4))
            rating = question_result(analytics, "rating")
            self.assertEqual(rating["answer_count"], 4)
            self.assertEqual(rating["average"], 3.75)
            self.assertEqual(rating["median"], 4.0)
            self.assertEqual((rating["minimum"], rating["maximum"]), (2.0, 5.0))
            self.assertEqual(
                rating["distribution"],
                [
                    {"label": "2", "count": 1},
                    {"label": "4", "count": 2},
                    {"label": "5", "count": 1},
                ],
            )

    async def test_median_of_an_odd_and_even_number_of_answers(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            for value in (1, 2, 9):
                await add_response(session, campaign, fixture, rating=value)
            odd = await campaign_analytics(session, fixture.workspace.id, campaign.id)
            self.assertEqual(question_result(odd, "rating")["median"], 2.0)
            await add_response(session, campaign, fixture, rating=10)
            even = await campaign_analytics(session, fixture.workspace.id, campaign.id)
            self.assertEqual(question_result(even, "rating")["median"], 5.5)

    async def test_choice_counts_are_grouped_by_option_label(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            for choice in ("yes", "yes", "no"):
                await add_response(session, campaign, fixture, choice=choice)
            await add_response(
                session, campaign, fixture, choice="no", status=ResponseStatus.IN_PROGRESS
            )
            analytics = await campaign_analytics(session, fixture.workspace.id, campaign.id)
            choices = {
                item["label"]: item["count"]
                for item in question_result(analytics, "choice")["choices"]
            }
            self.assertEqual(choices["Yes"], 2)
            self.assertEqual(choices["No"], 1)

    async def test_yes_no_reports_both_counts_even_when_one_is_zero(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            for value in (True, True, True):
                await add_response(session, campaign, fixture, yes_no=value)
            analytics = await campaign_analytics(session, fixture.workspace.id, campaign.id)
            self.assertEqual(
                question_result(analytics, "yes_no")["choices"],
                [{"label": "Yes", "count": 3}, {"label": "No", "count": 0}],
            )

    async def test_free_text_answers_are_collected_and_blanks_are_skipped(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            await add_response(session, campaign, fixture, comment="Great service")
            await add_response(session, campaign, fixture, comment="")
            await add_response(
                session, campaign, fixture, comment="Unfinished", status=ResponseStatus.IN_PROGRESS
            )
            analytics = await campaign_analytics(session, fixture.workspace.id, campaign.id)
            self.assertEqual(
                question_result(analytics, "comment")["text_answers"], ["Great service"]
            )

    async def test_responses_of_other_campaigns_are_not_counted(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            other = await make_campaign(session, fixture)
            await add_response(session, campaign, fixture, rating=5)
            await add_response(session, other, fixture, rating=1)
            analytics = await campaign_analytics(session, fixture.workspace.id, campaign.id)
            self.assertEqual(analytics["completed_count"], 1)
            self.assertEqual(question_result(analytics, "rating")["average"], 5.0)

    async def test_unknown_campaign_returns_404(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            with self.assertRaises(HTTPException) as context:
                await campaign_analytics(session, fixture.workspace.id, uuid4())
            self.assertEqual(context.exception.status_code, 404)

    async def test_a_campaign_cannot_be_read_through_another_workspace(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            _, other_workspace = await make_workspace(session)
            with self.assertRaises(HTTPException) as context:
                await campaign_analytics(session, other_workspace.id, campaign.id)
            self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
