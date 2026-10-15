from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import (
    OrganizationMember,
    Permission,
    Role,
    RolePermission,
    User,
    UserRole,
    Workspace,
    WorkspaceMember,
)


async def require_clinic_permission(
    session: AsyncSession, user: User, clinic_id: UUID, permission_name: str
) -> None:
    """
    Raise HTTP 403 if the user lacks permission in this clinic.
    Return None when access is allowed.
    """
    # Get permissions for the user's roles in the clinic
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=f"User {user.id} is not active"
        )

    try:
        is_platform_admin = await session.scalar(
            select(Role.id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user.id, Role.name == "platform_admin")
            .limit(1)
        )
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization storage is unavailable",
        ) from error
    if is_platform_admin is not None:
        return

    try:
        permission_id = await session.scalar(
            select(Permission.id)
            .select_from(WorkspaceMember)
            .join(RolePermission, RolePermission.role_id == WorkspaceMember.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(
                WorkspaceMember.user_id == user.id,
                WorkspaceMember.workspace_id == clinic_id,
                Permission.name == permission_name,
            )
            .limit(1)
        )
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization storage is unavailable",
        ) from error

    if permission_id is not None:
        return

    # An organization owner only ever gets an OrganizationMember row (never a
    # WorkspaceMember one for every workspace their org creates), so fall back
    # to checking the permission at the owning organization's scope before
    # rejecting.
    try:
        organization_permission_id = await session.scalar(
            select(Permission.id)
            .select_from(Workspace)
            .join(
                OrganizationMember, OrganizationMember.organization_id == Workspace.organization_id
            )
            .join(RolePermission, RolePermission.role_id == OrganizationMember.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(
                Workspace.id == clinic_id,
                OrganizationMember.user_id == user.id,
                Permission.name == permission_name,
            )
            .limit(1)
        )
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization storage is unavailable",
        ) from error

    if organization_permission_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User {user.id} does not have permission '{permission_name}' in clinic {clinic_id}",
        )


async def require_organization_permission(
    session: AsyncSession, user: User, organization_id: UUID, permission_name: str
) -> None:
    """
    Raise HTTP 403 if the user lacks permission in this organization.
    Return None when access is allowed.
    """
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=f"User {user.id} is not active"
        )

    try:
        is_platform_admin = await session.scalar(
            select(Role.id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user.id, Role.name == "platform_admin")
            .limit(1)
        )
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization storage is unavailable",
        ) from error
    if is_platform_admin is not None:
        return

    try:
        permission_id = await session.scalar(
            select(Permission.id)
            .select_from(OrganizationMember)
            .join(RolePermission, RolePermission.role_id == OrganizationMember.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(
                OrganizationMember.user_id == user.id,
                OrganizationMember.organization_id == organization_id,
                Permission.name == permission_name,
            )
            .limit(1)
        )
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization storage is unavailable",
        ) from error

    if permission_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User {user.id} does not have permission '{permission_name}' in organization {organization_id}",
        )


async def list_permitted_organization_ids(
    session: AsyncSession, user: User, permission_name: str
) -> list[UUID] | None:
    """Organization ids where the user's OrganizationMember role grants
    permission_name. Returns None for a platform_admin, meaning unrestricted
    (every organization), rather than an explicit (and easily misread as
    "none") empty list.
    """
    try:
        is_platform_admin = await session.scalar(
            select(Role.id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user.id, Role.name == "platform_admin")
            .limit(1)
        )
        if is_platform_admin is not None:
            return None

        result = await session.scalars(
            select(OrganizationMember.organization_id)
            .join(RolePermission, RolePermission.role_id == OrganizationMember.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(OrganizationMember.user_id == user.id, Permission.name == permission_name)
            .distinct()
        )
        return list(result)
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization storage is unavailable",
        ) from error


async def list_permitted_workspace_ids(
    session: AsyncSession, user: User, permission_name: str
) -> list[UUID] | None:
    """Workspace ids the user may act on for permission_name, via either a
    direct WorkspaceMember role or an OrganizationMember role in the
    workspace's organization (see require_clinic_permission's fallback).
    Returns None for a platform_admin (unrestricted).
    """
    try:
        is_platform_admin = await session.scalar(
            select(Role.id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user.id, Role.name == "platform_admin")
            .limit(1)
        )
        if is_platform_admin is not None:
            return None

        via_workspace = await session.scalars(
            select(WorkspaceMember.workspace_id)
            .join(RolePermission, RolePermission.role_id == WorkspaceMember.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(WorkspaceMember.user_id == user.id, Permission.name == permission_name)
        )
        via_organization = await session.scalars(
            select(Workspace.id)
            .join(
                OrganizationMember, OrganizationMember.organization_id == Workspace.organization_id
            )
            .join(RolePermission, RolePermission.role_id == OrganizationMember.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(OrganizationMember.user_id == user.id, Permission.name == permission_name)
        )
        return list({*via_workspace, *via_organization})
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization storage is unavailable",
        ) from error
