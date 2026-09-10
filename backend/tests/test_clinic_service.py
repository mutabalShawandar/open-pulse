import asyncio
import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.schemas.clinic import ClinicCreateRequest, ClinicMemberCreateRequest
from app.services.clinic_service import add_clinic_member, create_clinic


class ClinicServiceTests(unittest.TestCase):
    def test_missing_clinic_is_rejected(self) -> None:
        session = SequenceSession([None])
        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                add_clinic_member(
                    session,
                    uuid4(),
                    ClinicMemberCreateRequest(user_id=uuid4(), role_id=uuid4()),
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
                add_clinic_member(
                    session,
                    uuid4(),
                    ClinicMemberCreateRequest(user_id=uuid4(), role_id=uuid4()),
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
                add_clinic_member(
                    session,
                    uuid4(),
                    ClinicMemberCreateRequest(user_id=uuid4(), role_id=uuid4()),
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
                add_clinic_member(
                    session,
                    uuid4(),
                    ClinicMemberCreateRequest(user_id=uuid4(), role_id=uuid4()),
                    uuid4(),
                )
            )
        self.assertEqual(error.exception.status_code, 409)

    def test_duplicate_clinic_slug_is_rejected(self) -> None:
        session = CommitFailingSession()
        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                create_clinic(
                    session,
                    ClinicCreateRequest(name="Clinic", slug="clinic"),
                    uuid4(),
                )
            )
        self.assertEqual(error.exception.status_code, 409)
        self.assertTrue(session.rolled_back)


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
