import unittest

from sqlalchemy import select

from app.models import Role, UserRole
from app.services.authorization_service import get_global_access
from tests.integration.db import requires_database, rolled_back_session
from tests.integration.factories import make_user


@requires_database
class GlobalAccessTests(unittest.IsolatedAsyncioTestCase):
    async def test_user_without_a_role_has_no_global_access(self) -> None:
        async with rolled_back_session() as session:
            user = await make_user(session)
            self.assertEqual(await get_global_access(session, user), (False, []))

    async def test_platform_admin_can_manage_users(self) -> None:
        async with rolled_back_session() as session:
            user = await make_user(session)
            role = await session.scalar(select(Role).where(Role.name == "platform_admin"))
            assert role is not None
            session.add(UserRole(user_id=user.id, role_id=role.id))
            await session.flush()

            is_platform_admin, permissions = await get_global_access(session, user)

            self.assertTrue(is_platform_admin)
            self.assertIn("user.manage", permissions)
            self.assertEqual(permissions, sorted(set(permissions)))
