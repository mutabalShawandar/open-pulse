import os
import unittest
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings
from app.models import Organization, Workspace, WorkspaceMember, Role, Survey, SurveyStatus, SurveyVersion, SurveyVersionStatus, User
from app.services.survey_service import (
    assign_version_to_workspace,
    list_workspace_version_assignments,
    unassign_version_from_workspace,
)


@unittest.skipUnless(
    os.getenv("TEST_DATABASE_URL") or os.getenv("APP_ENV") == "test",
    "Set APP_ENV=test with .env.test to run PostgreSQL integration tests",
)
class SurveyVersionAssignmentTests(unittest.IsolatedAsyncioTestCase):
    async def test_assignment_is_clinic_scoped_and_unassignment_is_idempotent(self) -> None:
        database_url = os.getenv("TEST_DATABASE_URL", settings.database_url)
        engine = create_async_engine(database_url)
        async with engine.connect() as connection:
            transaction = await connection.begin()
            session = AsyncSession(bind=connection, expire_on_commit=False)
            try:
                role = await session.scalar(select(Role).where(Role.name == "clinic_manager"))
                assert role is not None
                actor = User(
                    email=f"assignment-{uuid4()}@example.test",
                    display_name="Assignment Test",
                    is_active=True,
                )
                organization = Organization(name="Assignment Organization", slug=f"assignment-org-{uuid4()}")
                session.add(organization)
                await session.flush()
                clinic = Workspace(name="Assignment Clinic", slug=f"assignment-{uuid4()}", organization_id=organization.id)
                session.add_all([actor, clinic])
                await session.flush()
                session.add(
                    WorkspaceMember(user_id=actor.id, workspace_id=clinic.id, role_id=role.id)
                )
                survey = Survey(
                    title="Assigned survey",
                    status=SurveyStatus.PUBLISHED,
                    created_by_user_id=actor.id,
                )
                session.add(survey)
                await session.flush()
                version = SurveyVersion(
                    survey_id=survey.id,
                    version_number=1,
                    status=SurveyVersionStatus.PUBLISHED,
                    published_at=datetime.now(UTC),
                    created_by_user_id=actor.id,
                )
                session.add(version)
                await session.flush()

                assignment = await assign_version_to_workspace(session, clinic.id, version.id, actor)
                self.assertEqual(assignment.workspace_id, clinic.id)
                self.assertEqual(assignment.survey_version_id, version.id)
                self.assertIsNone(assignment.unassigned_at)
                self.assertEqual(
                    len(await list_workspace_version_assignments(session, clinic.id, actor)), 1
                )

                await unassign_version_from_workspace(session, clinic.id, version.id, actor)
                await unassign_version_from_workspace(session, clinic.id, version.id, actor)
                self.assertEqual(
                    len(await list_workspace_version_assignments(session, clinic.id, actor)), 0
                )
            finally:
                await session.close()
                await transaction.rollback()
        await engine.dispose()
