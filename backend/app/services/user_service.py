from fastapi import HTTPException, status
from uuid import UUID
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.identity import ExternalIdentityLink
from app.models.user import User
from app.schemas.user import UserCreateRequest
from app.services.keycloak_admin import KeycloakAdminClient
from app.services.audit_service import add_audit_event


async def create_platform_user(
    session: AsyncSession,
    payload: UserCreateRequest,
    keycloak: KeycloakAdminClient,
    actor_user_id: UUID | None = None,
) -> User:
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
        add_audit_event(
            session,
            actor_user_id=actor_user_id,
            clinic_id=None,
            action="user.provisioned",
            entity_type="user",
            entity_id=user.id,
            metadata={"provider": "keycloak"},
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
