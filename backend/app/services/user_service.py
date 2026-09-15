from fastapi import HTTPException, status
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.identity import ExternalIdentityLink
from app.models.authorization import Role, UserRole
from app.models.user import User
from app.schemas.user import UserCreateRequest
from app.services.keycloak_admin import KeycloakAdminClient
from app.services.audit_service import add_audit_event


async def create_platform_user(
    session: AsyncSession,
    payload: UserCreateRequest,
    keycloak: KeycloakAdminClient,
    actor_user_id: UUID | None = None,
    is_platform_admin: bool = False,
) -> User:
    platform_admin_role = None
    if is_platform_admin:
        platform_admin_role = await session.scalar(
            select(Role).where(Role.name == "platform_admin")
        )
        if platform_admin_role is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Platform administrator role is not configured",
            )

    subject = await keycloak.create_user(
        email=payload.email,
        display_name=payload.display_name,
    )

    user = User(
        email=payload.email,
        display_name=payload.display_name,
        is_active=True,
    )
    session.add(user)

    try:
        await session.flush()
        session.add(
            ExternalIdentityLink(
                user_id=user.id,
                provider="keycloak",
                subject=subject,
            )
        )
        if platform_admin_role is not None:
            session.add(UserRole(user_id=user.id, role_id=platform_admin_role.id))
        add_audit_event(
            session,
            actor_user_id=actor_user_id,
            clinic_id=None,
            action="user.provisioned",
            entity_type="user",
            entity_id=user.id,
            metadata={
                "provider": "keycloak",
                "is_platform_admin": is_platform_admin,
            },
        )
        if is_platform_admin:
            add_audit_event(
                session,
                actor_user_id=actor_user_id,
                clinic_id=None,
                action="user.platform_admin_granted",
                entity_type="user",
                entity_id=user.id,
            )
        await session.commit()
        await session.refresh(user)
        try:
            await keycloak.send_account_setup_email(subject)
        except Exception as error:
            user.is_active = False
            await session.commit()
            await keycloak.disable_user(subject)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="User was created but the account setup email could not be sent",
            ) from error
        return user
    except IntegrityError as error:
        await session.rollback()
        await keycloak.disable_user(subject)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create the local user record",
        ) from error
    except SQLAlchemyError as error:
        await session.rollback()
        await keycloak.disable_user(subject)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Local user storage is unavailable",
        ) from error


async def grant_platform_admin(
    session: AsyncSession,
    *,
    user_id: UUID,
    actor_user_id: UUID,
) -> User:
    """Grant the global platform-admin role; safe to repeat."""
    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active user not found")

    role = await session.scalar(select(Role).where(Role.name == "platform_admin"))
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Platform administrator role is not configured",
        )

    assignment = await session.scalar(
        select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role.id)
    )
    if assignment is not None:
        return user

    session.add(UserRole(user_id=user.id, role_id=role.id))
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        clinic_id=None,
        action="user.platform_admin_granted",
        entity_type="user",
        entity_id=user.id,
    )
    try:
        await session.commit()
        await session.refresh(user)
    except SQLAlchemyError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not grant platform administrator role",
        ) from error
    return user
