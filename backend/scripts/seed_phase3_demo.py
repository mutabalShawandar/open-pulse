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
        clinic = Workspace(name="Demo Klinik", slug="demo-klinik", organization_id=organization.id)
        survey = Survey(organization_id=organization.id, title="Patientenzufriedenheit", description="Demo für Auswertungen", status=SurveyStatus.PUBLISHED, created_by_user_id=actor.id)
        session.add_all([clinic, survey]); await session.flush()
        version = SurveyVersion(survey_id=survey.id, version_number=1, status=SurveyVersionStatus.PUBLISHED, published_at=datetime.now(UTC), created_by_user_id=actor.id)
        session.add(version); await session.flush()
        session.add(SurveyVersionWorkspace(survey_version_id=version.id, workspace_id=clinic.id, assigned_by_user_id=actor.id))
        section = SurveySection(survey_version_id=version.id, title="Ihre Erfahrung", position=0)
        session.add(section); await session.flush()
        rating = SurveyQuestion(section_id=section.id, question_type=QuestionType.RATING, title="Wie zufrieden waren Sie insgesamt?", is_required=True, position=0)
        choice = SurveyQuestion(section_id=section.id, question_type=QuestionType.SINGLE_CHOICE, title="Würden Sie uns weiterempfehlen?", is_required=True, position=1)
        comment = SurveyQuestion(section_id=section.id, question_type=QuestionType.LONG_TEXT, title="Was können wir verbessern?", is_required=False, position=2)
        session.add_all([rating, choice, comment]); await session.flush()
        yes = SurveyQuestionOption(question_id=choice.id, label="Ja", value="yes", position=0)
        maybe = SurveyQuestionOption(question_id=choice.id, label="Vielleicht", value="maybe", position=1)
        no = SurveyQuestionOption(question_id=choice.id, label="Nein", value="no", position=2)
        session.add_all([yes, maybe, no]); await session.flush()
        campaign = Campaign(workspace_id=clinic.id, survey_version_id=version.id, title="September Zufriedenheitsumfrage", public_slug="demo-analytics", status=CampaignStatus.ACTIVE, response_identity_mode=ResponseIdentityMode.ANONYMOUS, created_by_user_id=actor.id)
        session.add(campaign); await session.flush()
        values = [(5, yes, "Sehr freundliches Team."), (4, yes, "Kurze Wartezeit, alles gut."), (4, maybe, "Die Parkplatzsituation könnte besser sein."), (3, maybe, "Der Empfang war etwas voll."), (5, yes, "Vielen Dank!"), (2, no, "Lange Wartezeit.")]
        for number, option, text in values:
            response = SurveyResponse(campaign_id=campaign.id, survey_version_id=version.id, status=ResponseStatus.COMPLETED, identity_mode_snapshot=ResponseIdentityMode.ANONYMOUS, completed_at=datetime.now(UTC))
            session.add(response); await session.flush()
            session.add(ResponseAnswer(response_id=response.id, question_id=rating.id, number_value=number))
            selected = ResponseAnswer(response_id=response.id, question_id=choice.id)
            session.add(selected); await session.flush()
            session.add(ResponseAnswerOption(answer_id=selected.id, option_id=option.id))
            session.add(ResponseAnswer(response_id=response.id, question_id=comment.id, text_value=text))
        await session.commit()
        print(f"Seeded clinic={clinic.id} campaign={campaign.id} slug={campaign.public_slug}")


if __name__ == "__main__":
    asyncio.run(seed())
