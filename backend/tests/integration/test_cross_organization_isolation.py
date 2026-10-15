import os
import unittest
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings
from app.models import Organization, OrganizationMember, Role, User, Workspace, WorkspaceMember
from app.services.authorization_service import (
    list_permitted_organization_ids,
    list_permitted_workspace_ids,
    require_clinic_permission,
    require_organization_permission,
)


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

        workspace_a = Workspace(
            name="Workspace A", slug=f"isolation-ws-a-{uuid4()}", organization_id=org_a.id
        )
        workspace_b = Workspace(
            name="Workspace B", slug=f"isolation-ws-b-{uuid4()}", organization_id=org_b.id
        )
        session.add_all([workspace_a, workspace_b])
        await session.flush()

        actor_a = User(
            email=f"actor-a-{uuid4()}@example.com", display_name="Actor A", is_active=True
        )
        session.add(actor_a)
        await session.flush()
        session.add(
            WorkspaceMember(
                user_id=actor_a.id, workspace_id=workspace_a.id, role_id=manager_role.id
            )
        )
        await session.flush()

        return org_a, org_b, workspace_a, workspace_b, actor_a

    async def test_workspace_scoped_permissions_reject_a_different_organizations_workspace(
        self,
    ) -> None:
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
                await require_clinic_permission(
                    self.session, actor_a, workspace_a.id, permission_name
                )

                # But not in workspace B, which belongs to a different organization.
                with self.assertRaises(HTTPException) as error:
                    await require_clinic_permission(
                        self.session, actor_a, workspace_b.id, permission_name
                    )
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

    async def test_require_clinic_permission_falls_back_to_organization_membership(self) -> None:
        """An organization_owner only ever gets an OrganizationMember row, never a
        WorkspaceMember one for every workspace their org creates — this is the
        fallback CodeRabbit flagged as missing (require_clinic_permission only
        checked WorkspaceMember), which would have 403'd every campaign/recipient/
        analytics/survey-version-assignment route for an org owner acting on their
        own organization's own workspace.
        """
        session = self.session
        owner_role = await session.scalar(select(Role).where(Role.name == "organization_owner"))
        assert owner_role is not None

        org_a = Organization(name="Fallback Org A", slug=f"fallback-org-a-{uuid4()}")
        org_b = Organization(name="Fallback Org B", slug=f"fallback-org-b-{uuid4()}")
        session.add_all([org_a, org_b])
        await session.flush()

        workspace_a = Workspace(
            name="Fallback Workspace A", slug=f"fallback-ws-a-{uuid4()}", organization_id=org_a.id
        )
        workspace_b = Workspace(
            name="Fallback Workspace B", slug=f"fallback-ws-b-{uuid4()}", organization_id=org_b.id
        )
        session.add_all([workspace_a, workspace_b])
        await session.flush()

        owner = User(email=f"owner-{uuid4()}@example.com", display_name="Org Owner", is_active=True)
        session.add(owner)
        await session.flush()
        # Deliberately no WorkspaceMember row — only OrganizationMember, matching
        # what organization_service.register_organization actually creates.
        session.add(
            OrganizationMember(user_id=owner.id, organization_id=org_a.id, role_id=owner_role.id)
        )
        await session.flush()

        # Allowed on their own org's workspace via the OrganizationMember fallback.
        await require_clinic_permission(session, owner, workspace_a.id, "campaign.create")

        # Still rejected for a workspace in a different organization.
        with self.assertRaises(HTTPException) as error:
            await require_clinic_permission(session, owner, workspace_b.id, "campaign.create")
        self.assertEqual(error.exception.status_code, 403)

    async def test_list_permitted_ids_are_scoped_per_actor(self) -> None:
        org_a, org_b, workspace_a, workspace_b, actor_a = await self._build_two_organizations()

        organization_ids = await list_permitted_organization_ids(
            self.session, actor_a, "survey.create"
        )
        self.assertEqual(
            organization_ids, []
        )  # actor_a is workspace-scoped only, not an org member

        workspace_ids = await list_permitted_workspace_ids(self.session, actor_a, "campaign.create")
        assert workspace_ids is not None
        self.assertIn(workspace_a.id, workspace_ids)
        self.assertNotIn(workspace_b.id, workspace_ids)

        no_access_user = User(
            email=f"no-access-{uuid4()}@example.com", display_name="No Access", is_active=True
        )
        self.session.add(no_access_user)
        await self.session.flush()
        self.assertEqual(
            await list_permitted_workspace_ids(self.session, no_access_user, "campaign.create"), []
        )
        self.assertEqual(
            await list_permitted_organization_ids(self.session, no_access_user, "survey.create"), []
        )
