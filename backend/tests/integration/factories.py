"""Builders for integration-test data. Every row uses unique slugs and emails."""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Campaign,
    CampaignStatus,
    Organization,
    QuestionType,
    ResponseIdentityMode,
    Survey,
    SurveyQuestion,
    SurveyQuestionOption,
    SurveySection,
    SurveyStatus,
    SurveyVersion,
    SurveyVersionStatus,
    SurveyVersionWorkspace,
    User,
    Workspace,
)


@dataclass
class SurveyFixture:
    organization: Organization
    workspace: Workspace
    survey: Survey
    version: SurveyVersion
    questions: dict[str, SurveyQuestion] = field(default_factory=dict)
    options: dict[str, SurveyQuestionOption] = field(default_factory=dict)


async def make_user(session: AsyncSession) -> User:
    user = User(email=f"user-{uuid4()}@example.test", display_name="Test User", is_active=True)
    session.add(user)
    await session.flush()
    return user


async def make_workspace(session: AsyncSession) -> tuple[Organization, Workspace]:
    organization = Organization(name="Test Organization", slug=f"org-{uuid4()}")
    session.add(organization)
    await session.flush()
    workspace = Workspace(
        name="Test Workspace", slug=f"workspace-{uuid4()}", organization_id=organization.id
    )
    session.add(workspace)
    await session.flush()
    return organization, workspace


async def make_published_survey(session: AsyncSession) -> SurveyFixture:
    """A published survey assigned to a new workspace with one question of each kind.

    Question keys: rating (required), choice (required, options yes/maybe/no),
    yes_no, comment (optional long text).
    """
    organization, workspace = await make_workspace(session)
    survey = Survey(
        organization_id=organization.id, title="Test survey", status=SurveyStatus.PUBLISHED
    )
    session.add(survey)
    await session.flush()
    version = SurveyVersion(
        survey_id=survey.id,
        version_number=1,
        status=SurveyVersionStatus.PUBLISHED,
        published_at=datetime.now(UTC),
    )
    session.add(version)
    await session.flush()
    session.add(SurveyVersionWorkspace(survey_version_id=version.id, workspace_id=workspace.id))
    section = SurveySection(survey_version_id=version.id, title="Section", position=0)
    session.add(section)
    await session.flush()
    fixture = SurveyFixture(organization, workspace, survey, version)
    for position, (key, question_type, required) in enumerate(
        [
            ("rating", QuestionType.RATING, True),
            ("choice", QuestionType.SINGLE_CHOICE, True),
            ("yes_no", QuestionType.YES_NO, False),
            ("comment", QuestionType.LONG_TEXT, False),
        ]
    ):
        question = SurveyQuestion(
            section_id=section.id,
            question_type=question_type,
            title=key,
            is_required=required,
            position=position,
        )
        session.add(question)
        fixture.questions[key] = question
    await session.flush()
    for position, value in enumerate(["yes", "maybe", "no"]):
        option = SurveyQuestionOption(
            question_id=fixture.questions["choice"].id,
            label=value.title(),
            value=value,
            position=position,
        )
        session.add(option)
        fixture.options[value] = option
    await session.flush()
    return fixture


async def make_campaign(
    session: AsyncSession,
    fixture: SurveyFixture,
    status: CampaignStatus = CampaignStatus.ACTIVE,
) -> Campaign:
    campaign = Campaign(
        workspace_id=fixture.workspace.id,
        survey_version_id=fixture.version.id,
        title="Test campaign",
        public_slug=f"campaign-{uuid4()}",
        status=status,
        response_identity_mode=ResponseIdentityMode.ANONYMOUS,
    )
    session.add(campaign)
    await session.flush()
    return campaign
