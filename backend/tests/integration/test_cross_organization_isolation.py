import os
import unittest
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings
from app.models import Organization, Role, User, Workspace, WorkspaceMember
from app.services.authorization_service import require_clinic_permission, require_organization_permission


@unittest.skipUnless(
    os.getenv("TEST_DATABASE_URL") or os.getenv("APP_ENV") == "test",
    "Set APP_ENV=test with .env.test to run PostgreSQL integration tests",
)
class CrossOrganizationIsolationTests(unittest.IsolatedAsyncioTestCase):
    """Every campaigns/recipients/analytics/clinic_survey_versions route resolves a
    workspace_id (from the path or from a loaded resource's own foreign key) and
    checks it via require_clinic_permission. This proves that check actually
    rejects a workspace-scoped actor from a different organization for every
    permission name those routers use, closing out MIGRATION_PLAN.md Step 7.
    """

    async def asyncSetUp(self) -> None:
        database_url = os.getenv("TEST_DATABASE_URL", settings.database_url)
        self.engine = create_async_engine(database_url)
        self.connection = await self.engine.connect()
        self.transaction = await self.connection.begin()
        self.session = AsyncSession(bind=self.connection, expire_on_commit=False)

    async def asyncTearDown(self) -> None:
        await self.session.close()
        await self.transaction.rollback()
        await self.engine.dispose()

    async def _build_two_organizations(self):
        session = self.session
        manager_role = await session.scalar(select(Role).where(Role.name == "clinic_manager"))
        assert manager_role is not None

        org_a = Organization(name="Isolation Org A", slug=f"isolation-org-a-{uuid4()}")
        org_b = Organization(name="Isolation Org B", slug=f"isolation-org-b-{uuid4()}")
        session.add_all([org_a, org_b])
        await session.flush()

        workspace_a = Workspace(name="Workspace A", slug=f"isolation-ws-a-{uuid4()}", organization_id=org_a.id)
        workspace_b = Workspace(name="Workspace B", slug=f"isolation-ws-b-{uuid4()}", organization_id=org_b.id)
        session.add_all([workspace_a, workspace_b])
        await session.flush()

        actor_a = User(email=f"actor-a-{uuid4()}@example.com", display_name="Actor A", is_active=True)
        session.add(actor_a)
        await session.flush()
        session.add(WorkspaceMember(user_id=actor_a.id, workspace_id=workspace_a.id, role_id=manager_role.id))
        await session.flush()

        return org_a, org_b, workspace_a, workspace_b, actor_a

    async def test_workspace_scoped_permissions_reject_a_different_organizations_workspace(self) -> None:
        _, _, workspace_a, workspace_b, actor_a = await self._build_two_organizations()

        # Every permission name campaigns.py, recipients.py, analytics.py, and
        # clinic_survey_versions.py actually check via require_clinic_permission.
        permissions_used_by_workspace_scoped_routes = [
            "campaign.create",
            "campaign.send",
            "response.view",
            "survey.read",
            "survey.assign",
        ]

        for permission_name in permissions_used_by_workspace_scoped_routes:
            with self.subTest(permission=permission_name):
                # Actor A holds this permission in their own workspace.
                await require_clinic_permission(self.session, actor_a, workspace_a.id, permission_name)

                # But not in workspace B, which belongs to a different organization.
                with self.assertRaises(HTTPException) as error:
                    await require_clinic_permission(self.session, actor_a, workspace_b.id, permission_name)
                self.assertEqual(error.exception.status_code, 403)

    async def test_organization_scoped_permissions_reject_a_different_organization(self) -> None:
        org_a, org_b, _workspace_a, _workspace_b, actor_a = await self._build_two_organizations()

        # Workspace membership does not, by itself, grant organization-scoped
        # permissions (survey.create/publish, clinic.create) in *any* org —
        # confirms the two permission systems (WorkspaceMember vs
        # OrganizationMember) are not accidentally cross-wired.
        with self.assertRaises(HTTPException) as error:
            await require_organization_permission(self.session, actor_a, org_a.id, "survey.create")
        self.assertEqual(error.exception.status_code, 403)

        with self.assertRaises(HTTPException) as error:
            await require_organization_permission(self.session, actor_a, org_b.id, "survey.create")
        self.assertEqual(error.exception.status_code, 403)
