import os
import unittest
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings
from app.models import Organization, OrganizationMember, Role, User
from app.schemas.organization import OrganizationRegisterRequest
from app.schemas.workspace import WorkspaceCreateRequest
from app.services.authorization_service import require_organization_permission
from app.services.organization_service import register_organization
from app.services.workspace_service import create_workspace


class FakeKeycloak:
    def __init__(self) -> None:
        self.disabled_subjects: list[str] = []

    async def create_user(self, **_kwargs) -> str:
        return f"subject-{uuid4()}"

    async def send_account_setup_email(self, _subject: str) -> None:
        pass

    async def disable_user(self, subject: str, **_kwargs) -> None:
        self.disabled_subjects.append(subject)


@unittest.skipUnless(
    os.getenv("TEST_DATABASE_URL") or os.getenv("APP_ENV") == "test",
    "Set APP_ENV=test with .env.test to run PostgreSQL integration tests",
)
class OrganizationRegistrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_registration_creates_org_and_grants_owner_workspace_access(self) -> None:
        database_url = os.getenv("TEST_DATABASE_URL", settings.database_url)
        engine = create_async_engine(database_url)
        async with engine.connect() as connection:
            transaction = await connection.begin()
            session = AsyncSession(bind=connection, expire_on_commit=False)
            try:
                payload = OrganizationRegisterRequest(
                    organization_name="Registration Org",
                    organization_slug=f"registration-org-{uuid4()}",
                    owner_email=f"owner-{uuid4()}@example.com",
                    owner_display_name="Registration Owner",
                )
                organization = await register_organization(session, payload, FakeKeycloak())

                membership = await session.scalar(
                    select(OrganizationMember).where(
                        OrganizationMember.organization_id == organization.id
                    )
                )
                self.assertIsNotNone(membership)

                owner = await session.scalar(select(User).where(User.id == membership.user_id))
                role = await session.scalar(select(Role).where(Role.id == membership.role_id))
                self.assertEqual(role.name, "organization_owner")
                self.assertTrue(owner.is_active)

                # The owner can create a workspace inside their own organization.
                await require_organization_permission(session, owner, organization.id, "clinic.create")
                workspace = await create_workspace(
                    session,
                    WorkspaceCreateRequest(
                        name="Registration Workspace",
                        slug=f"registration-workspace-{uuid4()}",
                        organization_id=organization.id,
                    ),
                    owner.id,
                )
                self.assertEqual(workspace.organization_id, organization.id)
            finally:
                await session.close()
                await transaction.rollback()
        await engine.dispose()

    async def test_owner_cannot_act_on_a_different_organization(self) -> None:
        database_url = os.getenv("TEST_DATABASE_URL", settings.database_url)
        engine = create_async_engine(database_url)
        async with engine.connect() as connection:
            transaction = await connection.begin()
            session = AsyncSession(bind=connection, expire_on_commit=False)
            try:
                payload = OrganizationRegisterRequest(
                    organization_name="Owner Org",
                    organization_slug=f"owner-org-{uuid4()}",
                    owner_email=f"owner-{uuid4()}@example.com",
                    owner_display_name="Owner Org Owner",
                )
                organization = await register_organization(session, payload, FakeKeycloak())
                membership = await session.scalar(
                    select(OrganizationMember).where(
                        OrganizationMember.organization_id == organization.id
                    )
                )
                owner = await session.scalar(select(User).where(User.id == membership.user_id))

                other_organization = Organization(
                    name="Other Organization", slug=f"other-org-{uuid4()}"
                )
                session.add(other_organization)
                await session.flush()

                with self.assertRaises(HTTPException) as error:
                    await require_organization_permission(
                        session, owner, other_organization.id, "clinic.create"
                    )
                self.assertEqual(error.exception.status_code, 403)
            finally:
                await session.close()
                await transaction.rollback()
        await engine.dispose()
