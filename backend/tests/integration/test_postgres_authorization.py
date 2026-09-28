import os
import unittest
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.models import AuditEvent, Organization, Workspace, WorkspaceMember, Permission, Role, User
from app.core.config import settings
from app.services.authorization_service import require_clinic_permission
from app.services.audit_service import add_audit_event


@unittest.skipUnless(
    os.getenv("TEST_DATABASE_URL") or os.getenv("APP_ENV") == "test",
    "Set APP_ENV=test with .env.test to run PostgreSQL integration tests",
)
class PostgresAuthorizationTests(unittest.IsolatedAsyncioTestCase):
    async def test_permission_is_scoped_to_the_user_and_clinic(self) -> None:
        database_url = os.getenv("TEST_DATABASE_URL", settings.database_url)
        engine = create_async_engine(database_url)
        async with engine.connect() as connection:
            transaction = await connection.begin()
            session = AsyncSession(bind=connection, expire_on_commit=False)
            try:
                role = await session.scalar(
                    select(Role).where(Role.name == "clinic_manager")
                )
                permission = await session.scalar(
                    select(Permission).where(Permission.name == "survey.create")
                )
                self.assertIsNotNone(role)
                self.assertIsNotNone(permission)
                assert role is not None

                user = User(
                    email=f"integration-{uuid4()}@example.test",
                    display_name="Integration User",
                    is_active=True,
                )
                other_user = User(
                    email=f"integration-other-{uuid4()}@example.test",
                    display_name="Other User",
                    is_active=True,
                )
                organization = Organization(
                    name="Integration Organization",
                    slug=f"integration-org-{uuid4()}",
                )
                session.add(organization)
                await session.flush()
                clinic = Workspace(
                    name="Integration Clinic",
                    slug=f"integration-{uuid4()}",
                    organization_id=organization.id,
                )
                other_clinic = Workspace(
                    name="Other Integration Clinic",
                    slug=f"integration-other-{uuid4()}",
                    organization_id=organization.id,
                )
                session.add_all([user, other_user, clinic, other_clinic])
                await session.flush()
                session.add_all(
                    [
                        WorkspaceMember(
                            user_id=user.id,
                            workspace_id=clinic.id,
                            role_id=role.id,
                        ),
                        WorkspaceMember(
                            user_id=other_user.id,
                            workspace_id=other_clinic.id,
                            role_id=role.id,
                        ),
                    ]
                )
                await session.flush()

                await require_clinic_permission(
                    session, user, clinic.id, "survey.create"
                )

                with self.assertRaises(HTTPException) as error:
                    await require_clinic_permission(
                        session, user, other_clinic.id, "survey.create"
                    )
                self.assertEqual(error.exception.status_code, 403)

                event = add_audit_event(
                    session,
                    actor_user_id=user.id,
                    workspace_id=clinic.id,
                    action="integration.checked",
                    entity_type="clinic",
                    entity_id=clinic.id,
                    metadata={"test": True},
                )
                await session.flush()
                stored_event = await session.scalar(
                    select(AuditEvent).where(AuditEvent.id == event.id)
                )
                self.assertIsNotNone(stored_event)
                assert stored_event is not None
                self.assertEqual(stored_event.action, "integration.checked")
                self.assertEqual(stored_event.event_metadata, {"test": True})
            finally:
                await session.close()
                await transaction.rollback()
        await engine.dispose()
