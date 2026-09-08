import asyncio
import unittest
from types import SimpleNamespace

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


def _payload() -> UserCreateRequest:
    return UserCreateRequest(
        email="new@example.com",
        display_name="New User",
    )


class UserServiceTests(unittest.TestCase):
    def test_database_failure_compensates_keycloak_user(self) -> None:
        keycloak = FakeKeycloak()
        session = FailingSession(SQLAlchemyError("database unavailable"))

        with self.assertRaises(HTTPException) as error:
            asyncio.run(create_platform_user(session, _payload(), keycloak))

        self.assertEqual(error.exception.status_code, 503)
        self.assertTrue(session.rolled_back)
        self.assertEqual(keycloak.disabled_subjects, ["created-subject"])
