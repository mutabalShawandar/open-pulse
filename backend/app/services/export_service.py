from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from io import BytesIO
from typing import Any
from uuid import UUID

import xlsxwriter
from fastapi import HTTPException
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Campaign,
    Workspace,
    ResponseAnswer,
    ResponseAnswerOption,
    ResponseStatus,
    Survey,
    SurveyQuestion,
    SurveyQuestionOption,
    SurveyResponse,
    SurveySection,
    SurveyVersion,
)
from app.services.analytics_service import campaign_analytics


QUESTION_TYPE_LABELS = {
    "single_choice": "Single choice",
    "multiple_choice": "Multiple choice",
    "yes_no": "Yes/No",
    "rating": "Rating",
    "short_text": "Short free text",
    "long_text": "Long free text",
    "number": "Number",
    "date": "Date",
}


def _number(value: Any) -> str:
    if value is None:
        return ""
    return f"{float(value):.2f}".rstrip("0").rstrip(".")


def _safe_filename(value: str) -> str:
    return "".join(character if character.isalnum() else "-" for character in value.lower()).strip("-") or "report"


def _format_answer(answer: ResponseAnswer, selected_labels: list[str]) -> str:
    parts = selected_labels.copy()
    if answer.boolean_value is not None:
        parts.append("Yes" if answer.boolean_value else "No")
    elif answer.text_value:
        parts.append(answer.text_value)
    elif answer.number_value is not None:
        parts.append(_number(answer.number_value))
    elif answer.date_value is not None:
        parts.append(answer.date_value.isoformat())
    if answer.other_text:
        parts.append(f"Other: {answer.other_text}")
    return "; ".join(parts)


async def export_report_data(session: AsyncSession, workspace_id: UUID, campaign_id: UUID) -> dict[str, Any]:
    campaign = await session.scalar(select(Campaign).where(Campaign.id == campaign_id, Campaign.workspace_id == workspace_id))
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    workspace = await session.scalar(select(Workspace).where(Workspace.id == workspace_id))
    survey = await session.scalar(
        select(Survey).join(SurveyVersion).where(SurveyVersion.id == campaign.survey_version_id),
    )
    analytics = await campaign_analytics(session, workspace_id, campaign_id)

    question_rows = list(
        await session.execute(
            select(SurveyQuestion, SurveySection.title)
            .join(SurveySection)
            .where(SurveySection.survey_version_id == campaign.survey_version_id)
            .order_by(SurveySection.position, SurveyQuestion.position),
        ),
    )
    questions = [question for question, _ in question_rows]
    question_sections = {question.id: section_title for question, section_title in question_rows}
    question_by_id = {question.id: question for question in questions}

    responses = list(
        await session.scalars(
            select(SurveyResponse)
            .where(SurveyResponse.campaign_id == campaign.id, SurveyResponse.status == ResponseStatus.COMPLETED)
            .order_by(SurveyResponse.completed_at, SurveyResponse.id),
        ),
    )
    response_ids = [response.id for response in responses]
    answer_rows = list(
        await session.scalars(select(ResponseAnswer).where(ResponseAnswer.response_id.in_(response_ids)))
    ) if response_ids else []
    answer_ids = [answer.id for answer in answer_rows]
    selected_options: dict[UUID, list[str]] = defaultdict(list)
    if answer_ids:
        option_rows = await session.execute(
            select(ResponseAnswerOption.answer_id, SurveyQuestionOption.label)
            .join(SurveyQuestionOption, SurveyQuestionOption.id == ResponseAnswerOption.option_id)
            .where(ResponseAnswerOption.answer_id.in_(answer_ids))
            .order_by(SurveyQuestionOption.position),
        )
        for answer_id, label in option_rows:
            selected_options[answer_id].append(label)

    answers_by_response: dict[UUID, dict[UUID, str]] = defaultdict(dict)
    normalized_answers: list[dict[str, str]] = []
    for answer in answer_rows:
        rendered = _format_answer(answer, selected_options[answer.id])
        answers_by_response[answer.response_id][answer.question_id] = rendered
        question = question_by_id[answer.question_id]
        response_number = next(index for index, response in enumerate(responses, 1) if response.id == answer.response_id)
        normalized_answers.append({
            "response_number": f"Response {response_number}",
            "completed_at": next(response.completed_at for response in responses if response.id == answer.response_id).isoformat(),
            "section": question_sections[question.id],
            "question": question.title,
            "question_type": QUESTION_TYPE_LABELS[question.question_type.value],
            "answer": rendered,
        })

    response_matrix = []
    for index, response in enumerate(responses, 1):
        response_matrix.append({
            "response_number": f"Response {index}",
            "completed_at": response.completed_at.isoformat() if response.completed_at else "",
            "answers": [answers_by_response[response.id].get(question.id, "") for question in questions],
        })

    return {
        "campaign": campaign,
        "workspace": workspace,
        "survey": survey,
        "questions": questions,
        "question_sections": question_sections,
        "analytics": analytics,
        "response_matrix": response_matrix,
        "normalized_answers": normalized_answers,
        "generated_at": datetime.now(UTC),
    }


def build_excel_export(data: dict[str, Any]) -> tuple[bytes, str]:
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output, {"in_memory": True})
    title = data["campaign"].title
    navy, teal, pale, text = "#16324F", "#0F766E", "#EAF4F2", "#243447"
    title_format = workbook.add_format({"bold": True, "font_size": 18, "font_color": "#FFFFFF", "bg_color": navy, "align": "left", "valign": "vcenter"})
    section_format = workbook.add_format({"bold": True, "font_color": "#FFFFFF", "bg_color": teal})
    label_format = workbook.add_format({"bold": True, "font_color": text, "bg_color": pale})
    value_format = workbook.add_format({"font_color": text})
    header_format = workbook.add_format({"bold": True, "font_color": "#FFFFFF", "bg_color": navy, "text_wrap": True, "valign": "vcenter"})
    body_format = workbook.add_format({"valign": "top", "text_wrap": True})
    date_format = workbook.add_format({"num_format": "yyyy-mm-dd hh:mm", "valign": "top"})
    integer_format = workbook.add_format({"num_format": "0", "valign": "top"})

    overview = workbook.add_worksheet("Overview")
    overview.hide_gridlines(2)
    overview.set_column("A:A", 25)
    overview.set_column("B:B", 44)
    overview.merge_range("A1:B1", f"Report - {title}", title_format)
    overview.set_row(0, 30)
    metadata = [
        ("Workspace", data["workspace"].name),
        ("Campaign", title),
        ("Survey", data["survey"].title if data["survey"] else ""),
        ("Status", data["campaign"].status.value),
        ("Started", data["analytics"]["started_count"]),
        ("Completed", data["analytics"]["completed_count"]),
        ("Created on", data["campaign"].created_at.isoformat()),
        ("Exported on", data["generated_at"].strftime("%Y-%m-%d %H:%M UTC")),
    ]
    overview.write("A3", "Campaign data", section_format)
    for row, (label, value) in enumerate(metadata, 3):
        overview.write(row, 0, label, label_format)
        overview.write(row, 1, value, value_format)
    overview.write("A13", "Contents", section_format)
    overview.merge_range("A14:B15", "This workbook contains the overview, question results, choice values, all responses and a normalized raw-data view.", body_format)

    question_sheet = workbook.add_worksheet("Questions")
    question_sheet.freeze_panes(1, 0)
    question_sheet.hide_gridlines(2)
    question_headers = ["Section", "Question", "Question type", "Answers", "Average", "Median", "Minimum", "Maximum", "Earliest date", "Latest date"]
    question_sheet.write_row(0, 0, question_headers, header_format)
    question_sheet.set_row(0, 34)
    question_sheet.set_column("A:A", 22)
    question_sheet.set_column("B:B", 46)
    question_sheet.set_column("C:C", 20)
    question_sheet.set_column("D:J", 16)
    analytics_by_question = {str(item["question_id"]): item for item in data["analytics"]["questions"]}
    for row, question in enumerate(data["questions"], 1):
        stats = analytics_by_question[str(question.id)]
        question_sheet.write_row(row, 0, [
            data["question_sections"][question.id], question.title, QUESTION_TYPE_LABELS[question.question_type.value],
            stats["answer_count"], stats["average"], stats["median"], stats["minimum"], stats["maximum"],
            stats["earliest_date"], stats["latest_date"],
        ], body_format)
        question_sheet.write_number(row, 3, stats["answer_count"], integer_format)
    question_sheet.add_table(0, 0, len(data["questions"]), len(question_headers) - 1, {"name": "QuestionSummary", "style": "Table Style Medium 2", "columns": [{"header": header} for header in question_headers]})

    choice_sheet = workbook.add_worksheet("Choice values")
    choice_sheet.freeze_panes(1, 0)
    choice_sheet.hide_gridlines(2)
    choice_headers = ["Question", "Answer option", "Count", "Share"]
    choice_sheet.write_row(0, 0, choice_headers, header_format)
    choice_sheet.set_row(0, 28)
    choice_sheet.set_column("A:A", 48)
    choice_sheet.set_column("B:B", 32)
    choice_sheet.set_column("C:D", 14)
    choice_rows: list[list[Any]] = []
    for question in data["analytics"]["questions"]:
        for choice in [*question["choices"], *question["distribution"]]:
            share = choice["count"] / question["answer_count"] if question["answer_count"] else 0
            choice_rows.append([question["title"], choice["label"], choice["count"], share])
    for row, values in enumerate(choice_rows, 1):
        choice_sheet.write_row(row, 0, values, body_format)
        choice_sheet.write_number(row, 2, values[2], integer_format)
        choice_sheet.write_number(row, 3, values[3], workbook.add_format({"num_format": "0.0%"}))
    if choice_rows:
        choice_sheet.add_table(0, 0, len(choice_rows), len(choice_headers) - 1, {"name": "ChoiceValues", "style": "Table Style Medium 4", "columns": [{"header": header} for header in choice_headers]})

    answers_sheet = workbook.add_worksheet("Responses")
    answers_sheet.freeze_panes(1, 2)
    answers_sheet.hide_gridlines(2)
    answer_headers = ["Response", "Completed on", *[question.title for question in data["questions"]]]
    answers_sheet.write_row(0, 0, answer_headers, header_format)
    answers_sheet.set_row(0, 46)
    answers_sheet.set_column("A:A", 13)
    answers_sheet.set_column("B:B", 21)
    answers_sheet.set_column(2, len(answer_headers) - 1, 30)
    for row, response in enumerate(data["response_matrix"], 1):
        answers_sheet.write(row, 0, response["response_number"], body_format)
        answers_sheet.write(row, 1, response["completed_at"], date_format)
        answers_sheet.write_row(row, 2, response["answers"], body_format)
    if data["response_matrix"]:
        answers_sheet.add_table(0, 0, len(data["response_matrix"]), len(answer_headers) - 1, {"name": "Responses", "style": "Table Style Medium 9", "columns": [{"header": header} for header in answer_headers]})

    normalized_sheet = workbook.add_worksheet("Responses normalized")
    normalized_sheet.freeze_panes(1, 0)
    normalized_sheet.hide_gridlines(2)
    normalized_headers = ["Response", "Completed on", "Section", "Question", "Question type", "Answer value"]
    normalized_sheet.write_row(0, 0, normalized_headers, header_format)
    normalized_sheet.set_row(0, 32)
    normalized_sheet.set_column("A:A", 13)
    normalized_sheet.set_column("B:B", 21)
    normalized_sheet.set_column("C:C", 20)
    normalized_sheet.set_column("D:D", 44)
    normalized_sheet.set_column("E:E", 20)
    normalized_sheet.set_column("F:F", 50)
    for row, answer in enumerate(data["normalized_answers"], 1):
        normalized_sheet.write_row(row, 0, [answer[key] for key in ["response_number", "completed_at", "section", "question", "question_type", "answer"]], body_format)
    if data["normalized_answers"]:
        normalized_sheet.add_table(0, 0, len(data["normalized_answers"]), len(normalized_headers) - 1, {"name": "NormalizedAnswers", "style": "Table Style Medium 6", "columns": [{"header": header} for header in normalized_headers]})

    workbook.close()
    filename = f"{_safe_filename(title)}-report.xlsx"
    return output.getvalue(), filename


def build_pdf_export(data: dict[str, Any]) -> tuple[bytes, str]:
    output = BytesIO()
    navy, teal, pale = HexColor("#16324F"), HexColor("#0F766E"), HexColor("#EAF4F2")
    document = SimpleDocTemplate(output, pagesize=A4, rightMargin=1.5 * cm, leftMargin=1.5 * cm, topMargin=1.7 * cm, bottomMargin=1.7 * cm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ReportTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=23, leading=28, textColor=navy, spaceAfter=8))
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=navy, spaceBefore=14, spaceAfter=8))
    styles.add(ParagraphStyle(name="Question", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=navy, spaceBefore=10, spaceAfter=4))
    styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontSize=8.5, leading=11, textColor=HexColor("#405260")))
    styles.add(ParagraphStyle(name="RightMetric", parent=styles["BodyText"], alignment=TA_RIGHT, fontName="Helvetica-Bold", fontSize=16, textColor=navy))

    def paragraph(value: Any, style: str = "BodyText") -> Paragraph:
        escaped = str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return Paragraph(escaped.replace("\n", "<br/>"), styles[style])

    story: list[Any] = [
        paragraph("Campaign report", "ReportTitle"),
        paragraph(data["campaign"].title, "Heading2"),
        paragraph(f"{data['workspace'].name} - Exported on {data['generated_at'].strftime('%Y-%m-%d %H:%M UTC')}", "Small"),
        Spacer(1, 0.35 * cm),
    ]
    meta_table = Table([
        [paragraph("Survey", "Small"), paragraph(data["survey"].title if data["survey"] else "", "Small")],
        [paragraph("Status", "Small"), paragraph(data["campaign"].status.value.capitalize(), "Small")],
        [paragraph("Created on", "Small"), paragraph(data["campaign"].created_at.strftime("%Y-%m-%d"), "Small")],
    ], colWidths=[4.1 * cm, 13.2 * cm])
    meta_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), pale), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), 0.25, HexColor("#C9DAD7")), ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story.extend([meta_table, Spacer(1, 0.45 * cm), paragraph("Participation", "Section")])
    metric_table = Table([
        [paragraph("Started", "Small"), paragraph("Completed", "Small"), paragraph("Completion rate", "Small")],
        [paragraph(data["analytics"]["started_count"], "RightMetric"), paragraph(data["analytics"]["completed_count"], "RightMetric"), paragraph(f"{(data['analytics']['completed_count'] / data['analytics']['started_count'] * 100) if data['analytics']['started_count'] else 0:.0f}%", "RightMetric")],
    ], colWidths=[5.8 * cm] * 3)
    metric_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), pale), ("GRID", (0, 0), (-1, -1), 0.25, HexColor("#C9DAD7")), ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.extend([metric_table, paragraph("Question results", "Section")])

    for question in data["analytics"]["questions"]:
        block: list[Any] = [paragraph(question["title"], "Question"), paragraph(f"{QUESTION_TYPE_LABELS[question['question_type']]} - {question['answer_count']} answers", "Small")]
        if question["average"] is not None:
            block.append(Table([[paragraph("Average", "Small"), paragraph("Median", "Small"), paragraph("Minimum", "Small"), paragraph("Maximum", "Small")], [paragraph(_number(question["average"]), "RightMetric"), paragraph(_number(question["median"]), "RightMetric"), paragraph(_number(question["minimum"]), "RightMetric"), paragraph(_number(question["maximum"]), "RightMetric")]], colWidths=[4.35 * cm] * 4, style=[("BACKGROUND", (0, 0), (-1, -1), pale), ("GRID", (0, 0), (-1, -1), 0.25, HexColor("#C9DAD7")), ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
        options = [*question["choices"], *question["distribution"]]
        if options:
            table_data = [[paragraph("Answer", "Small"), paragraph("Count", "Small"), paragraph("Share", "Small")]]
            for option in options:
                share = option["count"] / question["answer_count"] if question["answer_count"] else 0
                table_data.append([paragraph(option["label"], "Small"), paragraph(option["count"], "Small"), paragraph(f"{share:.0%}", "Small")])
            option_table = Table(table_data, colWidths=[11.1 * cm, 3.1 * cm, 3.2 * cm])
            option_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), navy), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("BACKGROUND", (0, 1), (-1, -1), colors.white), ("GRID", (0, 0), (-1, -1), 0.25, HexColor("#D5E1DF")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
            block.append(option_table)
            if len(options) <= 8:
                chart = VerticalBarChart()
                chart.data = [[option["count"] for option in options]]
                chart.categoryAxis.categoryNames = [str(option["label"])[:20] for option in options]
                chart.bars[0].fillColor = teal
                chart.valueAxis.valueMin = 0
                chart.width, chart.height = 15.5 * cm, 4.2 * cm
                drawing = Drawing(17 * cm, 5.2 * cm)
                drawing.add(chart)
                block.append(drawing)
        block.append(Spacer(1, 0.2 * cm))
        story.extend(block)

    story.append(PageBreak())
    story.append(paragraph("Appendix: full free-text answers", "Section"))
    text_rows = [answer for answer in data["normalized_answers"] if answer["question_type"] in {"Short free text", "Long free text"}]
    if text_rows:
        appendix = [[paragraph("Question", "Small"), paragraph("Answer", "Small")]]
        appendix.extend([[paragraph(row["question"], "Small"), paragraph(row["answer"], "Small")] for row in text_rows])
        table = Table(appendix, colWidths=[6 * cm, 11.4 * cm], repeatRows=1)
        table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), navy), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), 0.25, HexColor("#D5E1DF")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
        story.append(table)
    else:
        story.append(paragraph("There are no free-text answers for this campaign.", "BodyText"))

    def page_number(canvas: Any, _: Any) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(HexColor("#405260"))
        canvas.drawString(1.5 * cm, 1 * cm, f"{data['workspace'].name} - {data['campaign'].title}")
        canvas.drawRightString(A4[0] - 1.5 * cm, 1 * cm, f"Page {canvas.getPageNumber()}")
        canvas.restoreState()

    document.build(story, onFirstPage=page_number, onLaterPages=page_number)
    filename = f"{_safe_filename(data['campaign'].title)}-report.pdf"
    return output.getvalue(), filename
