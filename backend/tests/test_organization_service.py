import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.schemas.organization import OrganizationRegisterRequest
from app.services.organization_service import register_organization


class FakeKeycloak:
    def __init__(self) -> None:
        self.disabled_subjects: list[str] = []

    async def create_user(self, **_kwargs) -> str:
        return "created-subject"

    async def send_account_setup_email(self, _subject: str) -> None:
        pass

    async def disable_user(self, subject: str, **_kwargs) -> None:
        self.disabled_subjects.append(subject)


class EmailFailingKeycloak(FakeKeycloak):
    async def send_account_setup_email(self, _subject: str) -> None:
        raise RuntimeError("mail unavailable")


class SuccessfulSession:
    def __init__(self, scalar_results) -> None:
        self.scalar_results = list(scalar_results)
        self.values = []
        self.commit_count = 0

    async def scalar(self, _statement):
        return self.scalar_results.pop(0)

    def add(self, value) -> None:
        self.values.append(value)

    async def flush(self) -> None:
        pass

    async def commit(self) -> None:
        self.commit_count += 1

    async def refresh(self, _value) -> None:
        pass

    async def rollback(self) -> None:
        pass


class DuplicateSlugSession(SuccessfulSession):
    def __init__(self, owner_role) -> None:
        super().__init__([owner_role])
        self.flush_calls = 0
        self.rolled_back = False

    async def flush(self) -> None:
        self.flush_calls += 1
        if self.flush_calls == 1:
            raise IntegrityError("insert", {}, Exception("duplicate"))

    async def rollback(self) -> None:
        self.rolled_back = True


class DatabaseFailureSession(SuccessfulSession):
    def __init__(self, owner_role) -> None:
        super().__init__([owner_role])
        self.flush_calls = 0
        self.rolled_back = False

    async def flush(self) -> None:
        self.flush_calls += 1
        if self.flush_calls == 2:
            raise SQLAlchemyError("database unavailable")

    async def rollback(self) -> None:
        self.rolled_back = True


def _payload() -> OrganizationRegisterRequest:
    return OrganizationRegisterRequest(
        organization_name="Acme",
        organization_slug="acme",
        owner_email="owner@acme.example",
        owner_display_name="Ada Owner",
    )


class OrganizationServiceTests(unittest.TestCase):
    def test_successful_registration_creates_org_and_owner(self) -> None:
        owner_role = SimpleNamespace(id=uuid4(), name="organization_owner")
        keycloak = FakeKeycloak()
        session = SuccessfulSession([owner_role])

        organization = asyncio.run(register_organization(session, _payload(), keycloak))

        self.assertEqual(organization.name, "Acme")
        self.assertEqual(organization.slug, "acme")
        self.assertEqual(keycloak.disabled_subjects, [])
        self.assertEqual(session.commit_count, 1)
        self.assertTrue(
            any(value.__class__.__name__ == "OrganizationMember" for value in session.values)
        )
        self.assertTrue(
            any(
                getattr(value, "action", None) == "organization.registered"
                for value in session.values
            )
        )

    def test_missing_owner_role_raises_503(self) -> None:
        keycloak = FakeKeycloak()
        session = SuccessfulSession([None])

        with self.assertRaises(HTTPException) as error:
            asyncio.run(register_organization(session, _payload(), keycloak))

        self.assertEqual(error.exception.status_code, 503)

    def test_duplicate_slug_returns_409_and_rolls_back(self) -> None:
        owner_role = SimpleNamespace(id=uuid4(), name="organization_owner")
        keycloak = FakeKeycloak()
        session = DuplicateSlugSession(owner_role)

        with self.assertRaises(HTTPException) as error:
            asyncio.run(register_organization(session, _payload(), keycloak))

        self.assertEqual(error.exception.status_code, 409)
        self.assertTrue(session.rolled_back)
        # No Keycloak user should be created before the slug is confirmed available.
        self.assertEqual(keycloak.disabled_subjects, [])

    def test_setup_email_failure_disables_created_user(self) -> None:
        owner_role = SimpleNamespace(id=uuid4(), name="organization_owner")
        keycloak = EmailFailingKeycloak()
        session = SuccessfulSession([owner_role])

        with self.assertRaises(HTTPException) as error:
            asyncio.run(register_organization(session, _payload(), keycloak))

        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(keycloak.disabled_subjects, ["created-subject"])
        self.assertEqual(session.commit_count, 2)

    def test_database_failure_after_owner_creation_compensates_keycloak(self) -> None:
        owner_role = SimpleNamespace(id=uuid4(), name="organization_owner")
        keycloak = FakeKeycloak()
        session = DatabaseFailureSession(owner_role)

        with self.assertRaises(HTTPException) as error:
            asyncio.run(register_organization(session, _payload(), keycloak))

        self.assertEqual(error.exception.status_code, 503)
        self.assertTrue(session.rolled_back)
        self.assertEqual(keycloak.disabled_subjects, ["created-subject"])
