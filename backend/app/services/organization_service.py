from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.authorization import Role, OrganizationMember
from app.models.identity import ExternalIdentityLink
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organization import OrganizationRegisterRequest
from app.services.audit_service import add_audit_event
from app.services.keycloak_admin import KeycloakAdminClient


async def register_organization(
    session: AsyncSession,
    payload: OrganizationRegisterRequest,
    keycloak: KeycloakAdminClient,
) -> Organization:
    """Self-serve organization signup: creates the organization and its owner.

    The owner's local User row and OrganizationMember are created immediately, but
    they cannot obtain a session until Keycloak's VERIFY_EMAIL + UPDATE_PASSWORD
    required actions are completed (the same gate `create_platform_user` uses for
    admin-invited users) — this is what stands in for the "administrator-controlled
    workflow" domain boundary for a self-founded organization.
    """
    owner_role = await session.scalar(
        select(Role).where(Role.name == "organization_owner")
    )
    if owner_role is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Organization owner role is not configured",
        )

    organization = Organization(
        name=payload.organization_name,
        slug=payload.organization_slug,
    )
    session.add(organization)

    try:
        await session.flush()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organization with this slug already exists",
        ) from error

    subject = await keycloak.create_user(
        email=payload.owner_email,
        display_name=payload.owner_display_name,
    )

    owner = User(
        email=payload.owner_email,
        display_name=payload.owner_display_name,
        is_active=True,
    )
    session.add(owner)

    try:
        await session.flush()
        session.add(
            ExternalIdentityLink(
                user_id=owner.id,
                provider="keycloak",
                subject=subject,
            )
        )
        session.add(
            OrganizationMember(
                user_id=owner.id,
                organization_id=organization.id,
                role_id=owner_role.id,
            )
        )
        add_audit_event(
            session,
            actor_user_id=owner.id,
            workspace_id=None,
            action="organization.registered",
            entity_type="organization",
            entity_id=organization.id,
            metadata={"slug": organization.slug},
        )
        add_audit_event(
            session,
            actor_user_id=owner.id,
            workspace_id=None,
            action="organization.owner_provisioned",
            entity_type="user",
            entity_id=owner.id,
            metadata={"organization_id": str(organization.id)},
        )
        await session.commit()
        await session.refresh(organization)
        try:
            await keycloak.send_account_setup_email(subject)
        except Exception as error:
            owner.is_active = False
            await session.commit()
            await keycloak.disable_user(subject)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Organization was created but the account setup email could not be sent",
            ) from error
        return organization
    except IntegrityError as error:
        await session.rollback()
        await keycloak.disable_user(subject)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create the organization owner record",
        ) from error
    except SQLAlchemyError as error:
        await session.rollback()
        await keycloak.disable_user(subject)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Local user storage is unavailable",
        ) from error


async def is_slug_available(session: AsyncSession, slug: str) -> bool:
    existing = await session.scalar(select(Organization.id).where(Organization.slug == slug))
    return existing is None
