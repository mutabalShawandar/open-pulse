import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.schemas.workspace import WorkspaceCreateRequest, WorkspaceMemberCreateRequest, WorkspaceUpdateRequest
from app.services.workspace_service import add_workspace_member, create_workspace, remove_workspace_member, update_workspace


class WorkspaceServiceTests(unittest.TestCase):
    def test_missing_clinic_is_rejected(self) -> None:
        session = SequenceSession([None])
        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                add_workspace_member(
                    session,
                    uuid4(),
                    WorkspaceMemberCreateRequest(user_id=uuid4(), role_id=uuid4()),
                    uuid4(),
                )
            )
        self.assertEqual(error.exception.status_code, 404)

    def test_inactive_target_user_is_rejected(self) -> None:
        session = SequenceSession([
            SimpleNamespace(id=uuid4()),
            SimpleNamespace(id=uuid4(), is_active=False),
        ])
        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                add_workspace_member(
                    session,
                    uuid4(),
                    WorkspaceMemberCreateRequest(user_id=uuid4(), role_id=uuid4()),
                    uuid4(),
                )
            )
        self.assertEqual(error.exception.status_code, 404)

    def test_missing_role_is_rejected(self) -> None:
        session = SequenceSession([
            SimpleNamespace(id=uuid4()),
            SimpleNamespace(id=uuid4(), is_active=True),
            None,
        ])
        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                add_workspace_member(
                    session,
                    uuid4(),
                    WorkspaceMemberCreateRequest(user_id=uuid4(), role_id=uuid4()),
                    uuid4(),
                )
            )
        self.assertEqual(error.exception.status_code, 404)

    def test_duplicate_membership_is_rejected(self) -> None:
        session = SequenceSession([
            SimpleNamespace(id=uuid4()),
            SimpleNamespace(id=uuid4(), is_active=True),
            SimpleNamespace(id=uuid4()),
            SimpleNamespace(user_id=uuid4()),
        ])
        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                add_workspace_member(
                    session,
                    uuid4(),
                    WorkspaceMemberCreateRequest(user_id=uuid4(), role_id=uuid4()),
                    uuid4(),
                )
            )
        self.assertEqual(error.exception.status_code, 409)

    def test_duplicate_clinic_slug_is_rejected(self) -> None:
        session = CommitFailingSession()
        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                create_workspace(
                    session,
                    WorkspaceCreateRequest(name="Clinic", slug="clinic", organization_id=uuid4()),
                    uuid4(),
                )
            )
        self.assertEqual(error.exception.status_code, 409)
        self.assertTrue(session.rolled_back)

    def test_missing_membership_cannot_be_removed(self) -> None:
        session = SequenceSession([None])
        with self.assertRaises(HTTPException) as error:
            asyncio.run(remove_workspace_member(session, uuid4(), uuid4(), uuid4()))
        self.assertEqual(error.exception.status_code, 404)

    def test_membership_can_be_removed_and_is_audited(self) -> None:
        membership = SimpleNamespace(user_id=uuid4())

        class RemovalSession:
            def __init__(self) -> None:
                self.deleted = None
                self.commit_count = 0
                self.added = []

            async def scalar(self, _statement):
                return membership

            async def delete(self, value) -> None:
                self.deleted = value

            def add(self, value) -> None:
                self.added.append(value)

            async def commit(self) -> None:
                self.commit_count += 1

        session = RemovalSession()
        asyncio.run(remove_workspace_member(session, uuid4(), membership.user_id, uuid4()))
        self.assertIs(session.deleted, membership)
        self.assertEqual(session.commit_count, 1)
        self.assertEqual(session.added[0].action, "clinic.member_removed")

    def test_clinic_update_persists_changes_and_is_audited(self) -> None:
        workspace = SimpleNamespace(id=uuid4(), name="Before", slug="before")

        class UpdateSession:
            def __init__(self) -> None:
                self.added = []
                self.commit_count = 0

            async def scalar(self, _statement):
                return workspace

            async def flush(self) -> None:
                pass

            def add(self, value) -> None:
                self.added.append(value)

            async def commit(self) -> None:
                self.commit_count += 1

            async def refresh(self, _value) -> None:
                pass

        session = UpdateSession()
        updated = asyncio.run(
            update_workspace(
                session,
                workspace.id,
                WorkspaceUpdateRequest(name="After"),
                uuid4(),
            )
        )
        self.assertIs(updated, workspace)
        self.assertEqual(workspace.name, "After")
        self.assertEqual(session.commit_count, 1)
        self.assertEqual(session.added[0].action, "clinic.updated")


class SequenceSession:
    def __init__(self, values):
        self.values = list(values)

    async def scalar(self, _statement):
        return self.values.pop(0)


class CommitFailingSession:
    def __init__(self):
        self.rolled_back = False

    def add(self, _value):
        pass

    async def flush(self):
        pass

    async def commit(self):
        raise IntegrityError("insert", {}, Exception("duplicate"))

    async def rollback(self):
        self.rolled_back = True

    async def refresh(self, _value):
        pass
