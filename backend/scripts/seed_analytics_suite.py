"""Seed five local analytics campaigns covering every supported question type."""

import asyncio
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select

from app.db.session import async_session_factory
from app.models import Campaign, CampaignStatus, Workspace, QuestionType, ResponseAnswer, ResponseAnswerOption, ResponseIdentityMode, ResponseStatus, Survey, SurveyQuestion, SurveyQuestionOption, SurveyResponse, SurveySection, SurveyStatus, SurveyVersion, SurveyVersionWorkspace, SurveyVersionStatus, User


async def seed() -> None:
    async with async_session_factory() as session:
        if await session.scalar(select(Campaign).where(Campaign.public_slug == "analytics-suite-1")):
            print("Analytics suite already exists."); return
        actor = await session.scalar(select(User).where(User.is_active.is_(True)).limit(1))
        clinic = await session.scalar(select(Workspace).where(Workspace.slug == "demo-klinik"))
        if actor is None or clinic is None: raise RuntimeError("Run seed_phase3_demo first")
        survey = Survey(organization_id=clinic.organization_id, title="Vollständige Demo-Auswertung", status=SurveyStatus.PUBLISHED, created_by_user_id=actor.id); session.add(survey); await session.flush()
        version = SurveyVersion(survey_id=survey.id, version_number=1, status=SurveyVersionStatus.PUBLISHED, published_at=datetime.now(UTC), created_by_user_id=actor.id); session.add(version); await session.flush()
        session.add(SurveyVersionWorkspace(survey_version_id=version.id, workspace_id=clinic.id, assigned_by_user_id=actor.id))
        section = SurveySection(survey_version_id=version.id, title="Alle Fragetypen", position=0); session.add(section); await session.flush()
        types = [(QuestionType.SINGLE_CHOICE, "Wie bewerten Sie den Empfang?"), (QuestionType.MULTIPLE_CHOICE, "Was war Ihnen wichtig?"), (QuestionType.YES_NO, "Würden Sie wiederkommen?"), (QuestionType.RATING, "Gesamtbewertung"), (QuestionType.SHORT_TEXT, "Ein kurzes Stichwort"), (QuestionType.LONG_TEXT, "Ihr ausführliches Feedback"), (QuestionType.NUMBER, "Wartezeit in Minuten"), (QuestionType.DATE, "Datum Ihres Besuchs")]
        questions = []
        for position, (kind, title) in enumerate(types):
            question = SurveyQuestion(section_id=section.id, question_type=kind, title=title, position=position); session.add(question); questions.append(question)
        await session.flush()
        option_sets = {}
        for question, labels in ((questions[0], ["Sehr gut", "Gut", "Neutral", "Schlecht"]), (questions[1], ["Freundlichkeit", "Wartezeit", "Behandlung", "Räumlichkeiten"])):
            option_sets[question.id] = []
            for pos, label in enumerate(labels):
                option = SurveyQuestionOption(question_id=question.id, label=label, value=label.lower(), position=pos); session.add(option); option_sets[question.id].append(option)
        await session.flush()
        names = ["Januar", "Februar", "März", "April", "Mai"]
        for campaign_index, name in enumerate(names):
            campaign = Campaign(workspace_id=clinic.id, survey_version_id=version.id, title=f"{name} – Qualitätsumfrage", public_slug=f"analytics-suite-{campaign_index + 1}", status=CampaignStatus.ACTIVE if campaign_index == 4 else CampaignStatus.COMPLETED, response_identity_mode=ResponseIdentityMode.ANONYMOUS, created_by_user_id=actor.id); session.add(campaign); await session.flush()
            for response_index in range(12):
                response = SurveyResponse(campaign_id=campaign.id, survey_version_id=version.id, status=ResponseStatus.COMPLETED, identity_mode_snapshot=ResponseIdentityMode.ANONYMOUS, completed_at=datetime.now(UTC) - timedelta(days=response_index)); session.add(response); await session.flush()
                single = ResponseAnswer(response_id=response.id, question_id=questions[0].id); multi = ResponseAnswer(response_id=response.id, question_id=questions[1].id); session.add_all([single, multi]); await session.flush()
                session.add(ResponseAnswerOption(answer_id=single.id, option_id=option_sets[questions[0].id][response_index % 4].id))
                for option in option_sets[questions[1].id][: 1 + response_index % 3]: session.add(ResponseAnswerOption(answer_id=multi.id, option_id=option.id))
                session.add_all([ResponseAnswer(response_id=response.id, question_id=questions[2].id, boolean_value=response_index % 5 != 0), ResponseAnswer(response_id=response.id, question_id=questions[3].id, number_value=2 + response_index % 4), ResponseAnswer(response_id=response.id, question_id=questions[4].id, text_value=["Schnell", "Freundlich", "Kompetent"][response_index % 3]), ResponseAnswer(response_id=response.id, question_id=questions[5].id, text_value=f"Demo-Kommentar {response_index + 1} für die {name}-Kampagne."), ResponseAnswer(response_id=response.id, question_id=questions[6].id, number_value=5 + response_index * 3), ResponseAnswer(response_id=response.id, question_id=questions[7].id, date_value=date.today() - timedelta(days=response_index + campaign_index * 30))])
        await session.commit(); print("Seeded five analytics campaigns with every question type.")


if __name__ == "__main__": asyncio.run(seed())
