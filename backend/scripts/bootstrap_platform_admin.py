"""Bootstrap the first local platform administrator from an existing Keycloak user."""

import argparse
import asyncio
import sys
from pathlib import Path

# Allow direct execution from the backend/scripts directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.session import async_session_factory
from app.models.authorization import Role, UserRole
from app.models.identity import ExternalIdentityLink
from app.models.user import User
from app.services.keycloak_admin import KeycloakAdminClient


async def bootstrap(email: str) -> None:
    keycloak_user = await KeycloakAdminClient().find_user_by_email(email)
    if keycloak_user is None:
        raise RuntimeError(f"No Keycloak user found for {email}")

    subject = keycloak_user.get("id")
    if not subject:
        raise RuntimeError("Keycloak user did not include an id")

    async with async_session_factory() as session:
        try:
            user = await session.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(
                    email=email,
                    display_name=(
                        keycloak_user.get("firstName")
                        or keycloak_user.get("username")
                        or email
                    ),
                    is_active=True,
                )
                session.add(user)
                await session.flush()

            link = await session.scalar(
                select(ExternalIdentityLink).where(
                    ExternalIdentityLink.provider == "keycloak",
                    ExternalIdentityLink.subject == subject,
                )
            )
            if link is not None and link.user_id != user.id:
                raise RuntimeError("Keycloak user is already linked to another local user")
            if link is None:
                session.add(
                    ExternalIdentityLink(
                        user_id=user.id,
                        provider="keycloak",
                        subject=subject,
                    )
                )

            role = await session.scalar(
                select(Role).where(Role.name == "platform_admin")
            )
            if role is None:
                raise RuntimeError("Run `alembic upgrade head` before bootstrapping")

            assignment = await session.scalar(
                select(UserRole).where(
                    UserRole.user_id == user.id,
                    UserRole.role_id == role.id,
                )
            )
            if assignment is None:
                session.add(UserRole(user_id=user.id, role_id=role.id))

            await session.commit()
        except Exception:
            await session.rollback()
            raise

    print(f"Bootstrapped local platform administrator: {email}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    asyncio.run(bootstrap(args.email))


if __name__ == "__main__":
    main()
