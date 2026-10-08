from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.authorization import Role, UserRole
from app.models.identity import ExternalIdentityLink
from app.models.user import User
from app.schemas.user import UserCreateRequest
from app.services.audit_service import add_audit_event
from app.services.keycloak_admin import KeycloakAdminClient


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
            workspace_id=None,
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
                workspace_id=None,
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
        workspace_id=None,
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


async def deactivate_platform_user(
    session: AsyncSession,
    *,
    user_id: UUID,
    actor_user_id: UUID,
    keycloak: KeycloakAdminClient,
) -> User:
    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        return user

    identity = await session.scalar(
        select(ExternalIdentityLink).where(
            ExternalIdentityLink.user_id == user_id,
            ExternalIdentityLink.provider == "keycloak",
        )
    )
    if identity is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User does not have a Keycloak identity link",
        )

    await keycloak.disable_user(identity.subject, strict=True)
    user.is_active = False
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        workspace_id=None,
        action="user.deactivated",
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
            detail="Could not deactivate local user record",
        ) from error
    return user


async def reactivate_platform_user(
    session: AsyncSession,
    *,
    user_id: UUID,
    actor_user_id: UUID,
    keycloak: KeycloakAdminClient,
) -> User:
    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.is_active:
        return user

    identity = await session.scalar(
        select(ExternalIdentityLink).where(
            ExternalIdentityLink.user_id == user.id,
            ExternalIdentityLink.provider == "keycloak",
        )
    )
    if identity is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User does not have a Keycloak identity link",
        )

    await keycloak.enable_user(identity.subject)
    user.is_active = True
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        workspace_id=None,
        action="user.reactivated",
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
            detail="Keycloak account was enabled but local user reactivation failed",
        ) from error
    return user


async def permanently_delete_platform_user(
    session: AsyncSession,
    *,
    user_id: UUID,
    actor_user_id: UUID,
    keycloak: KeycloakAdminClient,
) -> None:
    """Delete a user from Keycloak and local access records, preserving audit events."""
    if user_id == actor_user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot permanently delete your own account",
        )

    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    platform_admin_role = await session.scalar(select(Role).where(Role.name == "platform_admin"))
    is_platform_admin = (
        platform_admin_role is not None
        and await session.scalar(
            select(UserRole).where(
                UserRole.user_id == user.id,
                UserRole.role_id == platform_admin_role.id,
            )
        )
        is not None
    )
    if is_platform_admin and platform_admin_role is not None:
        active_admin_count = await session.scalar(
            select(func.count(User.id))
            .join(UserRole, UserRole.user_id == User.id)
            .where(
                UserRole.role_id == platform_admin_role.id,
                User.is_active.is_(True),
            )
        )
        if active_admin_count is not None and active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The last platform administrator cannot be deleted",
            )

    identity = await session.scalar(
        select(ExternalIdentityLink).where(
            ExternalIdentityLink.user_id == user.id,
            ExternalIdentityLink.provider == "keycloak",
        )
    )
    if identity is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User does not have a Keycloak identity link",
        )

    # Avoid deleting local access until Keycloak confirms account deletion.
    await keycloak.delete_user(identity.subject)
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        workspace_id=None,
        action="user.permanently_deleted",
        entity_type="user",
        entity_id=user.id,
    )
    await session.delete(user)
    try:
        await session.commit()
    except SQLAlchemyError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Keycloak account was deleted but local user deletion failed",
        ) from error
