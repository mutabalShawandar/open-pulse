from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Role, User, Workspace, WorkspaceMember
from app.schemas.workspace import (
    WorkspaceCreateRequest,
    WorkspaceMemberCreateRequest,
    WorkspaceUpdateRequest,
)
from app.services.audit_service import add_audit_event


async def create_workspace(
    session: AsyncSession,
    payload: WorkspaceCreateRequest,
    actor_user_id: UUID,
) -> Workspace:
    workspace = Workspace(**payload.model_dump())
    session.add(workspace)
    try:
        await session.flush()
        add_audit_event(
            session,
            actor_user_id=actor_user_id,
            workspace_id=workspace.id,
            action="clinic.created",
            entity_type="clinic",
            entity_id=workspace.id,
            metadata={"slug": workspace.slug},
        )
        await session.commit()
        await session.refresh(workspace)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A clinic with this slug already exists",
        ) from error
    return workspace


async def update_workspace(
    session: AsyncSession,
    workspace_id: UUID,
    payload: WorkspaceUpdateRequest,
    actor_user_id: UUID,
) -> Workspace:
    workspace = await session.scalar(select(Workspace).where(Workspace.id == workspace_id))
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(workspace, field, value)

    try:
        await session.flush()
        add_audit_event(
            session,
            actor_user_id=actor_user_id,
            workspace_id=workspace.id,
            action="clinic.updated",
            entity_type="clinic",
            entity_id=workspace.id,
        )
        await session.commit()
        await session.refresh(workspace)
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A clinic with this slug already exists",
        ) from error
    return workspace


async def remove_workspace_member(
    session: AsyncSession,
    workspace_id: UUID,
    user_id: UUID,
    actor_user_id: UUID,
) -> None:
    membership = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Clinic membership not found"
        )

    await session.delete(membership)
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        workspace_id=workspace_id,
        action="clinic.member_removed",
        entity_type="clinic_member",
        entity_id=user_id,
    )
    await session.commit()


async def add_workspace_member(
    session: AsyncSession,
    workspace_id: UUID,
    payload: WorkspaceMemberCreateRequest,
    actor_user_id: UUID,
) -> WorkspaceMember:
    if await session.scalar(select(Workspace).where(Workspace.id == workspace_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clinic not found")

    user = await session.scalar(select(User).where(User.id == payload.user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active user not found")

    if await session.scalar(select(Role).where(Role.id == payload.role_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    if (
        await session.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.user_id == payload.user_id,
                WorkspaceMember.workspace_id == workspace_id,
            )
        )
        is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this clinic",
        )

    membership = WorkspaceMember(
        user_id=payload.user_id,
        workspace_id=workspace_id,
        role_id=payload.role_id,
    )
    session.add(membership)
    try:
        await session.flush()
        add_audit_event(
            session,
            actor_user_id=actor_user_id,
            workspace_id=workspace_id,
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
