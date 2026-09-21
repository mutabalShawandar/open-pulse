from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Campaign, ResponseAnswer, ResponseAnswerOption, ResponseStatus, SurveyQuestion, SurveyQuestionOption, SurveyResponse, SurveySection


async def campaign_analytics(session: AsyncSession, clinic_id: UUID, campaign_id: UUID) -> dict:
    campaign = await session.scalar(select(Campaign).where(Campaign.id == campaign_id, Campaign.clinic_id == clinic_id))
    if campaign is None: raise HTTPException(status_code=404, detail="Campaign not found")
    started = await session.scalar(select(func.count(SurveyResponse.id)).where(SurveyResponse.campaign_id == campaign.id)) or 0
    completed = await session.scalar(select(func.count(SurveyResponse.id)).where(SurveyResponse.campaign_id == campaign.id, SurveyResponse.status == ResponseStatus.COMPLETED)) or 0
    questions = list(await session.scalars(select(SurveyQuestion).join(SurveySection).where(SurveySection.survey_version_id == campaign.survey_version_id).order_by(SurveySection.position, SurveyQuestion.position)))
    result=[]
    for question in questions:
        answers = select(ResponseAnswer).join(SurveyResponse).where(ResponseAnswer.question_id == question.id, SurveyResponse.campaign_id == campaign.id, SurveyResponse.status == ResponseStatus.COMPLETED)
        answer_rows = list(await session.scalars(answers))
        answer_count = len(answer_rows)
        numeric_values = sorted(float(answer.number_value) for answer in answer_rows if answer.number_value is not None)
        median = None if not numeric_values else (numeric_values[len(numeric_values) // 2] if len(numeric_values) % 2 else (numeric_values[len(numeric_values) // 2 - 1] + numeric_values[len(numeric_values) // 2]) / 2)
        average = sum(numeric_values) / len(numeric_values) if numeric_values else None
        distribution = []
        if numeric_values:
            counts = {}
            for value in numeric_values: counts[str(value).rstrip("0").rstrip(".") if "." in str(value) else str(value)] = counts.get(str(value).rstrip("0").rstrip(".") if "." in str(value) else str(value), 0) + 1
            distribution = [{"label": label, "count": count} for label, count in sorted(counts.items(), key=lambda item: float(item[0]))]
        if question.question_type.value == "yes_no":
            true_count = sum(answer.boolean_value is True for answer in answer_rows)
            false_count = sum(answer.boolean_value is False for answer in answer_rows)
            choices = [{"label": "Ja", "count": true_count}, {"label": "Nein", "count": false_count}]
        else:
            choices=[]
        rows = await session.execute(select(SurveyQuestionOption.label, func.count(ResponseAnswerOption.option_id)).join(ResponseAnswerOption, ResponseAnswerOption.option_id == SurveyQuestionOption.id).join(ResponseAnswer, ResponseAnswer.id == ResponseAnswerOption.answer_id).join(SurveyResponse, SurveyResponse.id == ResponseAnswer.response_id).where(SurveyQuestionOption.question_id == question.id, SurveyResponse.campaign_id == campaign.id, SurveyResponse.status == ResponseStatus.COMPLETED).group_by(SurveyQuestionOption.id, SurveyQuestionOption.label).order_by(SurveyQuestionOption.position))
        if question.question_type.value in {"single_choice", "multiple_choice"}: choices=[{"label": label, "count": option_count} for label, option_count in rows]
        date_values = sorted(answer.date_value for answer in answer_rows if answer.date_value is not None)
        text_answers = [answer.text_value for answer in answer_rows if answer.text_value] + [answer.other_text for answer in answer_rows if answer.other_text]
        result.append({"question_id": question.id, "title": question.title, "question_type": question.question_type.value, "answer_count": answer_count, "average": average, "median": median, "minimum": numeric_values[0] if numeric_values else None, "maximum": numeric_values[-1] if numeric_values else None, "choices": choices, "distribution": distribution, "text_answers": text_answers, "earliest_date": date_values[0].isoformat() if date_values else None, "latest_date": date_values[-1].isoformat() if date_values else None})
    return {"campaign_id": campaign.id, "campaign_title": campaign.title, "started_count": started, "completed_count": completed, "questions": result}
