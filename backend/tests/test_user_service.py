import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.schemas.user import UserCreateRequest
from app.services.user_service import create_platform_user


class FakeKeycloak:
    def __init__(self) -> None:
        self.disabled_subjects: list[str] = []

    async def create_user(self, **_kwargs) -> str:
        return "created-subject"

    async def send_account_setup_email(self, _subject: str) -> None:
        pass

    async def disable_user(self, subject: str) -> None:
        self.disabled_subjects.append(subject)


class EmailFailingKeycloak(FakeKeycloak):
    async def send_account_setup_email(self, _subject: str) -> None:
        raise RuntimeError("mail unavailable")


class FailingSession:
    def __init__(self, error: Exception) -> None:
        self.error = error
        self.rolled_back = False

    def add(self, _value) -> None:
        pass

    async def flush(self) -> None:
        raise self.error

    async def rollback(self) -> None:
        self.rolled_back = True


class SuccessfulSession:
    def __init__(self) -> None:
        self.values = []
        self.commit_count = 0

    def add(self, value) -> None:
        self.values.append(value)

    async def flush(self) -> None:
        pass

    async def commit(self) -> None:
        self.commit_count += 1

    async def refresh(self, _value) -> None:
        pass


def _payload() -> UserCreateRequest:
    return UserCreateRequest(
        email="new@example.com",
        display_name="New User",
    )


class UserServiceTests(unittest.TestCase):
    def test_successful_provisioning_creates_local_records(self) -> None:
        keycloak = FakeKeycloak()
        session = SuccessfulSession()

        user = asyncio.run(
            create_platform_user(
                session,
                _payload(),
                keycloak,
                actor_user_id=uuid4(),
            )
        )

        self.assertEqual(user.email, "new@example.com")
        self.assertEqual(keycloak.disabled_subjects, [])
        self.assertEqual(session.commit_count, 1)
        self.assertEqual(len(session.values), 3)

    def test_setup_email_failure_disables_created_user(self) -> None:
        keycloak = EmailFailingKeycloak()
        session = SuccessfulSession()

        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                create_platform_user(
                    session,
                    _payload(),
                    keycloak,
                    actor_user_id=uuid4(),
                )
            )

        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(keycloak.disabled_subjects, ["created-subject"])
        self.assertEqual(session.commit_count, 2)

    def test_database_failure_compensates_keycloak_user(self) -> None:
        keycloak = FakeKeycloak()
        session = FailingSession(SQLAlchemyError("database unavailable"))

        with self.assertRaises(HTTPException) as error:
            asyncio.run(create_platform_user(session, _payload(), keycloak))

        self.assertEqual(error.exception.status_code, 503)
        self.assertTrue(session.rolled_back)
        self.assertEqual(keycloak.disabled_subjects, ["created-subject"])
