"""Create an idempotent local Phase-3 demo campaign with anonymous responses.

Run inside the backend container: python -m scripts.seed_phase3_demo
Never run this against production data.
"""

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select

from app.db.session import async_session_factory
from app.models import Campaign, CampaignStatus, Organization, Workspace, QuestionType, ResponseAnswer, ResponseAnswerOption, ResponseIdentityMode, ResponseStatus, Survey, SurveyQuestion, SurveyQuestionOption, SurveyResponse, SurveySection, SurveyStatus, SurveyVersion, SurveyVersionWorkspace, SurveyVersionStatus, User


async def seed() -> None:
    async with async_session_factory() as session:
        if await session.scalar(select(Campaign).where(Campaign.public_slug == "demo-analytics")):
            print("Phase-3 demo data already exists.")
            return
        actor = await session.scalar(select(User).where(User.is_active.is_(True)).limit(1))
        if actor is None:
            raise RuntimeError("Create a platform user before seeding demo data")
        organization = await session.scalar(select(Organization).where(Organization.slug == "demo-organization"))
        if organization is None:
            organization = Organization(name="Demo Organization", slug="demo-organization")
            session.add(organization); await session.flush()
        clinic = Workspace(name="Demo Workspace", slug="demo-workspace", organization_id=organization.id)
        survey = Survey(organization_id=organization.id, title="Customer satisfaction", description="Demo for analytics", status=SurveyStatus.PUBLISHED, created_by_user_id=actor.id)
        session.add_all([clinic, survey]); await session.flush()
        version = SurveyVersion(survey_id=survey.id, version_number=1, status=SurveyVersionStatus.PUBLISHED, published_at=datetime.now(UTC), created_by_user_id=actor.id)
        session.add(version); await session.flush()
        session.add(SurveyVersionWorkspace(survey_version_id=version.id, workspace_id=clinic.id, assigned_by_user_id=actor.id))
        section = SurveySection(survey_version_id=version.id, title="Your experience", position=0)
        session.add(section); await session.flush()
        rating = SurveyQuestion(section_id=section.id, question_type=QuestionType.RATING, title="How satisfied were you overall?", is_required=True, position=0)
        choice = SurveyQuestion(section_id=section.id, question_type=QuestionType.SINGLE_CHOICE, title="Would you recommend us?", is_required=True, position=1)
        comment = SurveyQuestion(section_id=section.id, question_type=QuestionType.LONG_TEXT, title="What can we improve?", is_required=False, position=2)
        session.add_all([rating, choice, comment]); await session.flush()
        yes = SurveyQuestionOption(question_id=choice.id, label="Yes", value="yes", position=0)
        maybe = SurveyQuestionOption(question_id=choice.id, label="Maybe", value="maybe", position=1)
        no = SurveyQuestionOption(question_id=choice.id, label="No", value="no", position=2)
        session.add_all([yes, maybe, no]); await session.flush()
        campaign = Campaign(workspace_id=clinic.id, survey_version_id=version.id, title="September satisfaction survey", public_slug="demo-analytics", status=CampaignStatus.ACTIVE, response_identity_mode=ResponseIdentityMode.ANONYMOUS, created_by_user_id=actor.id)
        session.add(campaign); await session.flush()
        values = [(5, yes, "Very friendly team."), (4, yes, "Short wait, all good."), (4, maybe, "The parking situation could be better."), (3, maybe, "The reception area was a bit crowded."), (5, yes, "Thank you!"), (2, no, "Long wait.")]
        for number, option, text in values:
            response = SurveyResponse(campaign_id=campaign.id, survey_version_id=version.id, status=ResponseStatus.COMPLETED, identity_mode_snapshot=ResponseIdentityMode.ANONYMOUS, completed_at=datetime.now(UTC))
            session.add(response); await session.flush()
            session.add(ResponseAnswer(response_id=response.id, question_id=rating.id, number_value=number))
            selected = ResponseAnswer(response_id=response.id, question_id=choice.id)
            session.add(selected); await session.flush()
            session.add(ResponseAnswerOption(answer_id=selected.id, option_id=option.id))
            session.add(ResponseAnswer(response_id=response.id, question_id=comment.id, text_value=text))
        await session.commit()
        print(f"Seeded workspace={clinic.id} campaign={campaign.id} slug={campaign.public_slug}")


if __name__ == "__main__":
    asyncio.run(seed())
