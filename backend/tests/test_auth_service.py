import asyncio
import unittest
from uuid import uuid4
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.dialects import postgresql

from app.services.authorization_service import require_clinic_permission

class AuthorizationServiceTestCase(unittest.IsolatedAsyncioTestCase):
    def test_authorization_database_failure_returns_503(self):
        user = SimpleNamespace(id=uuid4(), is_active=True)

        class FailingSession:
            async def scalar(self, _query):
                raise SQLAlchemyError("database unavailable")

        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                require_clinic_permission(
                    FailingSession(), user, uuid4(), "clinic.read"
                )
            )

        self.assertEqual(error.exception.status_code, 503)

    def test_missing_clinic_permission(self):
        # Create a mock session and user
        user = SimpleNamespace(id=uuid4(), is_active=True)
        clinic_id = uuid4()
        
        class FakeSession:
            async def scalar(self, query):
                return None  # Simulate no permission found
            
        with self.assertRaises(HTTPException) as error:
            asyncio.run(require_clinic_permission(FakeSession(), user, clinic_id, "survey.create"))
            
        self.assertEqual(error.exception.status_code, 403)

    def test_existing_clinic_permission_is_allowed(self):
        user = SimpleNamespace(id=uuid4(), is_active=True)
        clinic_id = uuid4()

        class FakeSession:
            def __init__(self) -> None:
                self.calls = 0

            async def scalar(self, query):
                self.calls += 1
                if self.calls == 1:
                    return None
                return uuid4()

        asyncio.run(
            require_clinic_permission(
                FakeSession(),
                user,
                clinic_id,
                "survey.create",
            )
        )

    def test_platform_admin_is_allowed_without_clinic_membership(self):
        user = SimpleNamespace(id=uuid4(), is_active=True)

        class FakeSession:
            async def scalar(self, _query):
                return uuid4()

        asyncio.run(
            require_clinic_permission(
                FakeSession(), user, uuid4(), "clinic.read"
            )
        )

    def test_inactive_user_is_rejected(self):
        user = SimpleNamespace(id=uuid4(), is_active=False)
        clinic_id = uuid4()

        class FakeSession:
            async def scalar(self, query):
                self.query_was_called = True
                return uuid4()

        session = FakeSession()
        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                require_clinic_permission(
                    session,
                    user,
                    clinic_id,
                    "survey.create",
                )
            )

        self.assertEqual(error.exception.status_code, 403)
        self.assertFalse(hasattr(session, "query_was_called"))

    def test_permission_query_is_scoped_to_user_clinic_and_permission(self):
        user = SimpleNamespace(id=uuid4(), is_active=True)
        clinic_id = uuid4()
        captured = {}

        class FakeSession:
            async def scalar(self, query):
                captured["query"] = query
                return None

        with self.assertRaises(HTTPException):
            asyncio.run(
                require_clinic_permission(
                    FakeSession(),
                    user,
                    clinic_id,
                    "survey.create",
                )
            )

        compiled = captured["query"].compile(dialect=postgresql.dialect())
        sql = str(compiled).lower()
        parameter_values = list(compiled.params.values())

        self.assertIn("workspace_members", sql)
        self.assertIn("role_permissions", sql)
        self.assertIn("permissions", sql)
        self.assertIn("workspace_members.user_id", sql)
        self.assertIn("workspace_members.workspace_id", sql)
        self.assertIn("permissions.name", sql)
        self.assertIn("limit", sql)
        self.assertIn(user.id, parameter_values)
        self.assertIn(clinic_id, parameter_values)
        self.assertIn("survey.create", parameter_values)
