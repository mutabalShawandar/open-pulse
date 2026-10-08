from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Campaign,
    CampaignRecipient,
    CampaignRecipientStatus,
    Recipient,
    RecipientStatus,
    Workspace,
)
from app.models.campaign import generate_response_token, hash_response_token
from app.schemas.recipient import RecipientCreateRequest
from app.services.audit_service import add_audit_event


async def _workspace_or_404(session: AsyncSession, workspace_id: UUID) -> None:
    if await session.get(Workspace, workspace_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")


async def list_recipients(session: AsyncSession, workspace_id: UUID) -> list[Recipient]:
    await _workspace_or_404(session, workspace_id)
    return list(
        await session.scalars(
            select(Recipient)
            .where(Recipient.workspace_id == workspace_id)
            .order_by(Recipient.email_normalized)
        )
    )


async def import_recipients(
    session: AsyncSession,
    workspace_id: UUID,
    payloads: list[RecipientCreateRequest],
    actor_user_id: UUID,
) -> tuple[list[Recipient], int]:
    await _workspace_or_404(session, workspace_id)
    unique_payloads = {item.email: item for item in payloads}
    existing = set(
        await session.scalars(
            select(Recipient.email_normalized).where(
                Recipient.workspace_id == workspace_id,
                Recipient.email_normalized.in_(unique_payloads),
            )
        )
    )
    created = [
        Recipient(
            workspace_id=workspace_id,
            display_name=item.display_name,
            email=item.email,
            email_normalized=item.email,
        )
        for email, item in unique_payloads.items()
        if email not in existing
    ]
    session.add_all(created)
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        workspace_id=workspace_id,
        action="recipient.imported",
        entity_type="recipient_batch",
        entity_id=None,
        metadata={"created_count": len(created), "duplicate_count": len(payloads) - len(created)},
    )
    await session.commit()
    for recipient in created:
        await session.refresh(recipient)
    return created, len(payloads) - len(created)


async def opt_out_recipient(
    session: AsyncSession, workspace_id: UUID, recipient_id: UUID, actor_user_id: UUID
) -> Recipient:
    recipient = await session.scalar(
        select(Recipient).where(
            Recipient.id == recipient_id, Recipient.workspace_id == workspace_id
        )
    )
    if recipient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")
    recipient.status = RecipientStatus.OPTED_OUT
    recipient.opted_out_at = datetime.now(UTC)
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        workspace_id=workspace_id,
        action="recipient.opted_out",
        entity_type="recipient",
        entity_id=recipient.id,
    )
    await session.commit()
    await session.refresh(recipient)
    return recipient


async def list_campaign_recipients(
    session: AsyncSession, campaign_id: UUID
) -> list[tuple[CampaignRecipient, Recipient]]:
    if await session.get(Campaign, campaign_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return list(
        await session.execute(
            select(CampaignRecipient, Recipient)
            .join(Recipient, Recipient.id == CampaignRecipient.recipient_id)
            .where(CampaignRecipient.campaign_id == campaign_id)
            .order_by(Recipient.email_normalized)
        )
    )


async def assign_campaign_recipients(
    session: AsyncSession, campaign_id: UUID, recipient_ids: list[UUID], actor_user_id: UUID
) -> list[tuple[CampaignRecipient, Recipient]]:
    campaign = await session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    if campaign.status.value not in {"draft", "scheduled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recipients can only be changed before a campaign is active",
        )
    ids = list(dict.fromkeys(recipient_ids))
    recipients = list(
        await session.scalars(
            select(Recipient).where(
                Recipient.id.in_(ids), Recipient.workspace_id == campaign.workspace_id
            )
        )
    )
    if len(recipients) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Every recipient must belong to the campaign workspace",
        )
    existing = set(
        await session.scalars(
            select(CampaignRecipient.recipient_id).where(
                CampaignRecipient.campaign_id == campaign_id,
                CampaignRecipient.recipient_id.in_(ids),
            )
        )
    )
    created = []
    for recipient in recipients:
        if recipient.id not in existing and recipient.status == RecipientStatus.ACTIVE:
            item = CampaignRecipient(
                campaign_id=campaign_id,
                recipient_id=recipient.id,
                token_hash=hash_response_token(generate_response_token()),
                status=CampaignRecipientStatus.PENDING,
            )
            session.add(item)
            created.append((item, recipient))
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        workspace_id=campaign.workspace_id,
        action="campaign.recipients_assigned",
        entity_type="campaign",
        entity_id=campaign.id,
        metadata={"created_count": len(created)},
    )
    await session.commit()
    for item, _ in created:
        await session.refresh(item)
    return created


async def remove_campaign_recipient(
    session: AsyncSession, campaign_id: UUID, recipient_id: UUID, actor_user_id: UUID
) -> None:
    campaign = await session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    if campaign.status.value not in {"draft", "scheduled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recipients can only be changed before a campaign is active",
        )
    item = await session.scalar(
        select(CampaignRecipient).where(
            CampaignRecipient.campaign_id == campaign_id,
            CampaignRecipient.recipient_id == recipient_id,
        )
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign recipient not found"
        )
    await session.delete(item)
    add_audit_event(
        session,
        actor_user_id=actor_user_id,
        workspace_id=campaign.workspace_id,
        action="campaign.recipient_removed",
        entity_type="campaign",
        entity_id=campaign.id,
        metadata={"recipient_id": str(recipient_id)},
    )
    await session.commit()
