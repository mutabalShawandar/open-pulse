from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_permission
from app.db.session import get_db_session
from app.models import User
from app.schemas.campaign import CampaignCreateRequest, CampaignResponse, CampaignUpdateRequest
from app.services.campaign_service import campaign_response_data, create_campaign, delete_campaign, get_campaign_or_404, list_campaigns, update_campaign


router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign_endpoint(payload: CampaignCreateRequest, actor: Annotated[User, Depends(require_permission("campaign.create"))], session: AsyncSession = Depends(get_db_session)) -> CampaignResponse:
    return CampaignResponse(**await campaign_response_data(session, await create_campaign(session, payload, actor.id)))


@router.get("", response_model=list[CampaignResponse])
async def list_campaigns_endpoint(clinic_id: UUID | None = None, _: Annotated[User, Depends(get_current_user)] = None, session: AsyncSession = Depends(get_db_session)) -> list[CampaignResponse]:
    return [CampaignResponse(**await campaign_response_data(session, campaign)) for campaign in await list_campaigns(session, clinic_id)]


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign_endpoint(campaign_id: UUID, _: Annotated[User, Depends(get_current_user)] = None, session: AsyncSession = Depends(get_db_session)) -> CampaignResponse:
    return CampaignResponse(**await campaign_response_data(session, await get_campaign_or_404(session, campaign_id)))


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign_endpoint(campaign_id: UUID, payload: CampaignUpdateRequest, actor: Annotated[User, Depends(require_permission("campaign.create"))], session: AsyncSession = Depends(get_db_session)) -> CampaignResponse:
    return CampaignResponse(**await campaign_response_data(session, await update_campaign(session, campaign_id, payload, actor.id)))


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign_endpoint(campaign_id: UUID, actor: Annotated[User, Depends(require_permission("campaign.create"))], session: AsyncSession = Depends(get_db_session)) -> None:
    await delete_campaign(session, campaign_id, actor.id)
