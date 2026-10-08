import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from app.models import QuestionType, SurveyStatus, SurveyVersionStatus
from app.schemas.survey import SurveyCreateRequest, SurveyQuestionCreateRequest
from app.services.survey_service import (
    _require_choice_question,
    _validate_rule_value,
    create_question,
    create_survey,
    get_draft_or_404,
    get_survey_or_404,
    reorder_sections,
)


class SurveyServiceTests(unittest.TestCase):
    def test_create_survey_creates_an_initial_draft_and_audit_event(self) -> None:
        organization_id = uuid4()
        session = RecordingSession(organization=SimpleNamespace(id=organization_id))
        survey, draft = asyncio.run(
            create_survey(
                session,
                SurveyCreateRequest(
                    organization_id=organization_id,
                    title="Patientenzufriedenheit",
                    initial_draft_label="Entwurf A",
                ),
                uuid4(),
            )
        )

        self.assertEqual(survey.organization_id, organization_id)
        self.assertEqual(survey.status, SurveyStatus.DRAFT)
        self.assertEqual(draft.status, SurveyVersionStatus.DRAFT)
        self.assertEqual(draft.survey_id, survey.id)
        self.assertEqual(draft.draft_label, "Entwurf A")
        self.assertTrue(session.committed)
        self.assertEqual(session.added[-1].action, "survey.created")
        self.assertEqual(session.added[-1].event_metadata, {"draft_id": str(draft.id)})

    def test_missing_survey_is_rejected(self) -> None:
        session = SimpleNamespace(scalar=_async_return(None))
        with self.assertRaises(HTTPException) as error:
            asyncio.run(get_survey_or_404(session, uuid4()))
        self.assertEqual(error.exception.status_code, 404)

    def test_published_version_cannot_be_edited_as_a_draft(self) -> None:
        survey_id = uuid4()
        draft_id = uuid4()
        version = SimpleNamespace(
            id=draft_id,
            survey_id=survey_id,
            status=SurveyVersionStatus.PUBLISHED,
        )
        session = SimpleNamespace(scalar=_async_return(version))
        with self.assertRaises(HTTPException) as error:
            asyncio.run(get_draft_or_404(session, survey_id, draft_id))
        self.assertEqual(error.exception.status_code, 409)

    def test_reorder_rejects_duplicate_or_missing_section_ids(self) -> None:
        survey_id = uuid4()
        draft_id = uuid4()
        first_id = uuid4()
        second_id = uuid4()
        draft = SimpleNamespace(survey_id=survey_id, status=SurveyVersionStatus.DRAFT)
        sections = [
            SimpleNamespace(id=first_id, position=0),
            SimpleNamespace(id=second_id, position=1),
        ]
        session = ReorderSession(draft, sections)
        with self.assertRaises(HTTPException) as error:
            asyncio.run(reorder_sections(session, survey_id, draft_id, [first_id, first_id]))
        self.assertEqual(error.exception.status_code, 422)
        self.assertFalse(session.committed)

    def test_create_question_appends_to_a_draft_section(self) -> None:
        survey_id = uuid4()
        draft_id = uuid4()
        section_id = uuid4()
        session = SequenceRecordingSession(
            [
                SimpleNamespace(survey_id=survey_id, status=SurveyVersionStatus.DRAFT),
                SimpleNamespace(id=section_id),
                None,
            ]
        )

        question = asyncio.run(
            create_question(
                session,
                survey_id,
                draft_id,
                section_id,
                SurveyQuestionCreateRequest(
                    question_type=QuestionType.RATING,
                    title="Wie zufrieden sind Sie?",
                    is_required=True,
                ),
            )
        )

        self.assertEqual(question.section_id, section_id)
        self.assertEqual(question.question_type, QuestionType.RATING)
        self.assertEqual(question.position, 0)
        self.assertTrue(session.committed)

    def test_options_are_rejected_for_non_choice_questions(self) -> None:
        question = SimpleNamespace(question_type=QuestionType.SHORT_TEXT)
        with self.assertRaises(HTTPException) as error:
            _require_choice_question(question)
        self.assertEqual(error.exception.status_code, 422)

    def test_validation_rule_must_match_the_question_type(self) -> None:
        question = SimpleNamespace(question_type=QuestionType.RATING)
        _validate_rule_value(question, "min_value", {"value": 1})
        with self.assertRaises(HTTPException) as error:
            _validate_rule_value(question, "min_date", {"value": "2026-01-01"})
        self.assertEqual(error.exception.status_code, 422)

    def test_date_validation_requires_an_iso_date(self) -> None:
        question = SimpleNamespace(question_type=QuestionType.DATE)
        with self.assertRaises(HTTPException) as error:
            _validate_rule_value(question, "min_date", {"value": "tomorrow"})
        self.assertEqual(error.exception.status_code, 422)


class RecordingSession:
    def __init__(self, organization: object | None = None) -> None:
        self.added: list[object] = []
        self.committed = False
        self.organization = organization

    def add(self, value: object) -> None:
        if getattr(value, "id", None) is None:
            value.id = uuid4()
        self.added.append(value)

    async def scalar(self, _statement):
        return self.organization

    async def flush(self) -> None:
        pass

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, _value: object) -> None:
        pass

    async def rollback(self) -> None:
        pass


class ReorderSession:
    def __init__(self, draft, sections) -> None:
        self.draft = draft
        self.sections = sections
        self.committed = False

    async def scalar(self, _statement):
        return self.draft

    async def scalars(self, _statement):
        return self.sections


class SequenceRecordingSession(RecordingSession):
    def __init__(self, values) -> None:
        super().__init__()
        self.values = list(values)

    async def scalar(self, _statement):
        return self.values.pop(0)


def _async_return(value):
    async def result(*_args, **_kwargs):
        return value

    return result
