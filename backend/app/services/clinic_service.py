from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Clinic, ClinicMember, Role, User
from app.schemas.clinic import ClinicCreateRequest, ClinicMemberCreateRequest
from app.services.audit_service import add_audit_event


async def create_clinic(
    session: AsyncSession,
    payload: ClinicCreateRequest,
    actor_user_id: UUID,
) -> Clinic:
    clinic = Clinic(**payload.model_dump())
    session.add(clinic)
    try:
        await session.flush()
        add_audit_event(
            session,
            actor_user_id=actor_user_id,
            clinic_id=clinic.id,
            action="clinic.created",
            entity_type="clinic",
            entity_id=clinic.id,
            metadata={"slug": clinic.slug},
        )
        await session.commit()
        await session.refresh(clinic)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A clinic with this slug already exists",
        ) from error
    return clinic


async def add_clinic_member(
    session: AsyncSession,
    clinic_id: UUID,
    payload: ClinicMemberCreateRequest,
    actor_user_id: UUID,
) -> ClinicMember:
    if await session.scalar(select(Clinic).where(Clinic.id == clinic_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")

    user = await session.scalar(select(User).where(User.id == payload.user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active user not found")

    if await session.scalar(select(Role).where(Role.id == payload.role_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    if await session.scalar(
        select(ClinicMember).where(
            ClinicMember.user_id == payload.user_id,
            ClinicMember.clinic_id == clinic_id,
        )
    ) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this clinic",
        )

    membership = ClinicMember(
        user_id=payload.user_id,
        clinic_id=clinic_id,
        role_id=payload.role_id,
    )
    session.add(membership)
    try:
        await session.flush()
        add_audit_event(
            session,
            actor_user_id=actor_user_id,
            clinic_id=clinic_id,
            action="clinic.member_added",
            entity_type="clinic_member",
            entity_id=payload.user_id,
            metadata={"role_id": str(payload.role_id)},
        )
        await session.commit()
        await session.refresh(membership)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create clinic membership",
        ) from error

    return membership
