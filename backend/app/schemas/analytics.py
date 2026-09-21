from uuid import UUID
from pydantic import BaseModel


class AnalyticsQuestion(BaseModel):
    question_id: UUID
    title: str
    question_type: str
    answer_count: int
    average: float | None = None
    median: float | None = None
    minimum: float | None = None
    maximum: float | None = None
    choices: list[dict[str, int | str]] = []
    distribution: list[dict[str, int | str]] = []
    text_answers: list[str] = []
    earliest_date: str | None = None
    latest_date: str | None = None


class CampaignAnalyticsResponse(BaseModel):
    campaign_id: UUID
    campaign_title: str
    started_count: int
    completed_count: int
    questions: list[AnalyticsQuestion]
