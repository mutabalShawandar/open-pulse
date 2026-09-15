from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.future import select

from app.models import User, ClinicMember, Permission, Role, RolePermission, UserRole


async def require_clinic_permission(
    session: AsyncSession, 
    user: User, 
    clinic_id: UUID,
    permission_name: str
) -> None:
    """
    Raise HTTP 403 if the user lacks permission in this clinic.
    Return None when access is allowed.
    """
    # Get permissions for the user's roles in the clinic
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User {user.id} is not active"
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
            select(Permission.id).select_from(ClinicMember)
            .join(RolePermission, RolePermission.role_id == ClinicMember.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(
                ClinicMember.user_id == user.id,
                ClinicMember.clinic_id == clinic_id,
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
            detail=f"User {user.id} does not have permission '{permission_name}' in clinic {clinic_id}"
        )
    
