import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.core.config import settings
from app.schemas.email import SmtpConfigurationUpsertRequest
from app.services.smtp_service import _decrypt_password, save_smtp_configuration


class FakeSession:
    def __init__(self, existing=None) -> None:
        self.existing = existing
        self.values = []
        self.commits = 0

    async def scalar(self, _query):
        return self.existing

    def add(self, value) -> None:
        self.values.append(value)

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, _value) -> None:
        pass


def payload(**overrides) -> SmtpConfigurationUpsertRequest:
    values = {
        "host": "smtp.example.test",
        "port": 587,
        "use_starttls": True,
        "use_ssl": False,
        "username": "mailer",
        "password": "secret-value",
        "sender_name": "OpenPulse",
        "sender_email": "mailer@example.test",
    }
    values.update(overrides)
    return SmtpConfigurationUpsertRequest(**values)


class SmtpServiceTests(unittest.TestCase):
    def test_credentials_are_encrypted_and_can_be_decrypted(self) -> None:
        session = FakeSession()
        key = Fernet.generate_key().decode("utf-8")
        with patch.object(settings, "email_credential_encryption_key", key):
            configuration = asyncio.run(save_smtp_configuration(session, payload(), uuid4()))
            self.assertNotEqual(configuration.password_encrypted, "secret-value")
            self.assertEqual(_decrypt_password(configuration), "secret-value")
        self.assertEqual(session.commits, 1)

    def test_new_authenticated_configuration_requires_a_password(self) -> None:
        session = FakeSession()
        key = Fernet.generate_key().decode("utf-8")
        with patch.object(settings, "email_credential_encryption_key", key):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(save_smtp_configuration(session, payload(password=None), uuid4()))
        self.assertEqual(error.exception.status_code, 422)

    def test_removing_username_removes_stored_password(self) -> None:
        configuration = SimpleNamespace(
            host="smtp.example.test",
            port=587,
            use_starttls=True,
            use_ssl=False,
            username="mailer",
            password_encrypted=None,
            sender_name="OpenPulse",
            sender_email="mailer@example.test",
            id=uuid4(),
            updated_by_user_id=None,
        )
        session = FakeSession(configuration)
        key = Fernet.generate_key().decode("utf-8")
        with patch.object(settings, "email_credential_encryption_key", key):
            configuration.password_encrypted = Fernet(key.encode()).encrypt(b"secret-value").decode()
            asyncio.run(save_smtp_configuration(session, payload(username=None, password=None), uuid4()))
        self.assertIsNone(configuration.password_encrypted)
