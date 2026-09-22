from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_permission, require_platform_admin
from app.db.session import get_db_session
from app.models import AuditEvent, Clinic, ClinicMember, Role, User
from app.schemas.authorization import AuditEventResponse, PermissionResponse, RoleResponse
from app.schemas.email import (
    SmtpConfigurationResponse,
    SmtpConfigurationUpsertRequest,
    SmtpTestEmailRequest,
)
from app.services.smtp_service import (
    get_smtp_configuration,
    save_smtp_configuration,
    send_smtp_test_email,
)
from app.schemas.clinic import (
    ClinicMemberResponse,
    ClinicResponse,
    ClinicUpdateRequest,
)
from app.schemas.user import UserResponse
from app.services.clinic_service import remove_clinic_member, update_clinic
from app.services.keycloak_admin import KeycloakAdminClient
from app.services.user_service import (
    deactivate_platform_user,
    permanently_delete_platform_user,
    reactivate_platform_user,
)


router = APIRouter(tags=["administration"])


@router.get("/api/v1/administration/smtp", response_model=SmtpConfigurationResponse | None, tags=["administration"])
async def get_smtp_configuration_endpoint(
    _: Annotated[User, Depends(require_platform_admin)],
    session: AsyncSession = Depends(get_db_session),
) -> SmtpConfigurationResponse | None:
    configuration = await get_smtp_configuration(session)
    if configuration is None:
        return None
    return SmtpConfigurationResponse.model_validate(
        {**{field: getattr(configuration, field) for field in SmtpConfigurationResponse.model_fields if field != "password_configured"}, "password_configured": configuration.password_encrypted is not None}
    )


@router.put("/api/v1/administration/smtp", response_model=SmtpConfigurationResponse, tags=["administration"])
async def save_smtp_configuration_endpoint(
    payload: SmtpConfigurationUpsertRequest,
    actor: Annotated[User, Depends(require_platform_admin)],
    session: AsyncSession = Depends(get_db_session),
) -> SmtpConfigurationResponse:
    configuration = await save_smtp_configuration(session, payload, actor.id)
    return SmtpConfigurationResponse.model_validate(
        {**{field: getattr(configuration, field) for field in SmtpConfigurationResponse.model_fields if field != "password_configured"}, "password_configured": configuration.password_encrypted is not None}
    )


@router.post("/api/v1/administration/smtp/test", status_code=status.HTTP_204_NO_CONTENT, tags=["administration"])
async def test_smtp_configuration_endpoint(
    payload: SmtpTestEmailRequest,
    actor: Annotated[User, Depends(require_platform_admin)],
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    await send_smtp_test_email(session, payload.recipient_email, actor.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
@router.get("/api/v1/clinics", response_model=list[ClinicResponse], tags=["clinic"])
async def list_clinics_endpoint(
    _: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> list[ClinicResponse]:
    """List every clinic for every active platform user."""
    clinics = (await session.scalars(select(Clinic).order_by(Clinic.name))).all()
    return [ClinicResponse.model_validate(clinic) for clinic in clinics]


@router.patch("/api/v1/clinics/{clinic_id}", response_model=ClinicResponse, tags=["clinic"])
async def update_clinic_endpoint(
    clinic_id: UUID,
    payload: ClinicUpdateRequest,
    actor: Annotated[User, Depends(require_permission("clinic.create"))],
    session: AsyncSession = Depends(get_db_session),
) -> ClinicResponse:
    clinic = await update_clinic(session, clinic_id, payload, actor.id)
    return ClinicResponse.model_validate(clinic)


@router.get(
    "/api/v1/clinics/{clinic_id}/members",
    response_model=list[ClinicMemberResponse],
    tags=["clinic"],
)
async def list_clinic_members_endpoint(
    clinic_id: UUID,
    _: Annotated[User, Depends(require_permission("role.assign"))],
    session: AsyncSession = Depends(get_db_session),
) -> list[ClinicMemberResponse]:
    rows = (
        await session.execute(
            select(ClinicMember, User, Role)
            .join(User, User.id == ClinicMember.user_id)
            .join(Role, Role.id == ClinicMember.role_id)
            .where(ClinicMember.clinic_id == clinic_id)
            .order_by(User.email)
        )
    ).all()
    return [
        ClinicMemberResponse(
            user_id=membership.user_id,
            clinic_id=membership.clinic_id,
            role_id=membership.role_id,
            user_email=user.email,
            user_display_name=user.display_name,
            role_name=role.name,
        )
        for membership, user, role in rows
    ]


@router.delete(
    "/api/v1/clinics/{clinic_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["clinic"],
)
async def remove_clinic_member_endpoint(
    clinic_id: UUID,
    user_id: UUID,
    actor: Annotated[User, Depends(require_permission("role.assign"))],
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    await remove_clinic_member(session, clinic_id, user_id, actor.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/v1/users", response_model=list[UserResponse], tags=["user"])
async def list_users_endpoint(
    _: Annotated[User, Depends(require_permission("user.manage"))],
    session: AsyncSession = Depends(get_db_session),
) -> list[UserResponse]:
    users = (await session.scalars(select(User).order_by(User.email))).all()
    return [
        UserResponse(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            is_active=user.is_active,
        )
        for user in users
    ]


@router.get("/api/v1/users/{user_id}", response_model=UserResponse, tags=["user"])
async def get_user_endpoint(
    user_id: UUID,
    _: Annotated[User, Depends(require_permission("user.manage"))],
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse(id=str(user.id), email=user.email, display_name=user.display_name, is_active=user.is_active)


@router.post("/api/v1/users/{user_id}/deactivate", response_model=UserResponse, tags=["user"])
async def deactivate_user_endpoint(
    user_id: UUID,
    actor: Annotated[User, Depends(require_permission("user.manage"))],
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    user = await deactivate_platform_user(
        session,
        user_id=user_id,
        actor_user_id=actor.id,
        keycloak=KeycloakAdminClient(),
    )
    return UserResponse(id=str(user.id), email=user.email, display_name=user.display_name, is_active=user.is_active)


@router.post("/api/v1/users/{user_id}/reactivate", response_model=UserResponse, tags=["user"])
async def reactivate_user_endpoint(
    user_id: UUID,
    actor: Annotated[User, Depends(require_permission("user.manage"))],
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    user = await reactivate_platform_user(
        session,
        user_id=user_id,
        actor_user_id=actor.id,
        keycloak=KeycloakAdminClient(),
    )
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
    )


@router.delete("/api/v1/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["user"])
async def permanently_delete_user_endpoint(
    user_id: UUID,
    actor: Annotated[User, Depends(require_platform_admin)],
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    await permanently_delete_platform_user(
        session,
        user_id=user_id,
        actor_user_id=actor.id,
        keycloak=KeycloakAdminClient(),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/v1/roles", response_model=list[RoleResponse], tags=["roles"])
async def list_roles_endpoint(
    _: Annotated[User, Depends(require_permission("role.assign"))],
    session: AsyncSession = Depends(get_db_session),
) -> list[RoleResponse]:
    roles = (await session.scalars(select(Role).order_by(Role.name))).all()
    return [RoleResponse.model_validate(role) for role in roles]


@router.get("/api/v1/permissions", response_model=list[PermissionResponse], tags=["roles"])
async def list_permissions_endpoint(
    _: Annotated[User, Depends(require_permission("role.assign"))],
    session: AsyncSession = Depends(get_db_session),
) -> list[PermissionResponse]:
    permissions = (await session.scalars(select(Permission).order_by(Permission.name))).all()
    return [PermissionResponse.model_validate(permission) for permission in permissions]


@router.get("/api/v1/audit-events", response_model=list[AuditEventResponse], tags=["audit"])
async def list_audit_events_endpoint(
    clinic_id: UUID | None = None,
    limit: int = 100,
    _: User = Depends(require_permission("audit.view")),
    session: AsyncSession = Depends(get_db_session),
) -> list[AuditEventResponse]:
    safe_limit = min(max(limit, 1), 250)
    statement = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(safe_limit)
    if clinic_id is not None:
        statement = statement.where(AuditEvent.clinic_id == clinic_id)
    events = (await session.scalars(statement)).all()
    return [AuditEventResponse.model_validate(event) for event in events]
