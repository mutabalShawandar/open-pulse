from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.db.session import get_db_session
from app.models import User
from app.schemas.recipient import CampaignRecipientAssignRequest, CampaignRecipientResponse, RecipientCreateRequest, RecipientImportRequest, RecipientImportResponse, RecipientResponse
from app.services.recipient_service import assign_campaign_recipients, import_recipients, list_campaign_recipients, list_recipients, opt_out_recipient, remove_campaign_recipient

router = APIRouter(prefix="/api/v1/clinics/{clinic_id}/recipients", tags=["recipients"])


@router.get("", response_model=list[RecipientResponse])
async def list_recipients_endpoint(clinic_id: UUID, _: Annotated[User, Depends(require_permission("campaign.send"))], session: AsyncSession = Depends(get_db_session)) -> list[RecipientResponse]:
    return [RecipientResponse.model_validate(item, from_attributes=True) for item in await list_recipients(session, clinic_id)]


@router.post("", response_model=RecipientResponse, status_code=status.HTTP_201_CREATED)
async def create_recipient_endpoint(clinic_id: UUID, payload: RecipientCreateRequest, actor: Annotated[User, Depends(require_permission("campaign.send"))], session: AsyncSession = Depends(get_db_session)) -> RecipientResponse:
    created, _ = await import_recipients(session, clinic_id, [payload], actor.id)
    if not created:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Recipient already exists for this clinic")
    return RecipientResponse.model_validate(created[0], from_attributes=True)


@router.post("/import", response_model=RecipientImportResponse, status_code=status.HTTP_201_CREATED)
async def import_recipients_endpoint(clinic_id: UUID, payload: RecipientImportRequest, actor: Annotated[User, Depends(require_permission("campaign.send"))], session: AsyncSession = Depends(get_db_session)) -> RecipientImportResponse:
    created, duplicates = await import_recipients(session, clinic_id, payload.recipients, actor.id)
    return RecipientImportResponse(created_count=len(created), duplicate_count=duplicates, recipients=[RecipientResponse.model_validate(item, from_attributes=True) for item in created])


@router.post("/{recipient_id}/opt-out", response_model=RecipientResponse)
async def opt_out_recipient_endpoint(clinic_id: UUID, recipient_id: UUID, actor: Annotated[User, Depends(require_permission("campaign.send"))], session: AsyncSession = Depends(get_db_session)) -> RecipientResponse:
    return RecipientResponse.model_validate(await opt_out_recipient(session, clinic_id, recipient_id, actor.id), from_attributes=True)


def campaign_recipient_response(item, recipient) -> CampaignRecipientResponse:
    return CampaignRecipientResponse(id=item.id, campaign_id=item.campaign_id, recipient_id=recipient.id, display_name=recipient.display_name, email=recipient.email, recipient_status=recipient.status, status=item.status, sent_at=item.sent_at, last_error=item.last_error, created_at=item.created_at)


campaign_router = APIRouter(prefix="/api/v1/campaigns/{campaign_id}/recipients", tags=["campaign recipients"])


@campaign_router.get("", response_model=list[CampaignRecipientResponse])
async def list_campaign_recipients_endpoint(campaign_id: UUID, _: Annotated[User, Depends(require_permission("campaign.send"))], session: AsyncSession = Depends(get_db_session)) -> list[CampaignRecipientResponse]:
    return [campaign_recipient_response(item, recipient) for item, recipient in await list_campaign_recipients(session, campaign_id)]


@campaign_router.post("", response_model=list[CampaignRecipientResponse], status_code=status.HTTP_201_CREATED)
async def assign_campaign_recipients_endpoint(campaign_id: UUID, payload: CampaignRecipientAssignRequest, actor: Annotated[User, Depends(require_permission("campaign.send"))], session: AsyncSession = Depends(get_db_session)) -> list[CampaignRecipientResponse]:
    return [campaign_recipient_response(item, recipient) for item, recipient in await assign_campaign_recipients(session, campaign_id, payload.recipient_ids, actor.id)]


@campaign_router.delete("/{recipient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_campaign_recipient_endpoint(campaign_id: UUID, recipient_id: UUID, actor: Annotated[User, Depends(require_permission("campaign.send"))], session: AsyncSession = Depends(get_db_session)) -> None:
    await remove_campaign_recipient(session, campaign_id, recipient_id, actor.id)
