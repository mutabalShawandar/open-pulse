from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_permission
from app.db.session import get_db_session
from app.models import CampaignEmailTemplate, CampaignStatus, Clinic, User
from app.schemas.email import CampaignDeliveryQueueResponse, CampaignDeliveryResponse, CampaignEmailTemplateRequest, CampaignEmailTemplateResponse, CampaignEmailTemplateTestRequest
from app.schemas.campaign import CampaignCreateRequest, CampaignResponse, CampaignUpdateRequest
from app.services.campaign_service import campaign_response_data, create_campaign, delete_campaign, get_campaign_or_404, list_campaigns, update_campaign
from app.services.delivery_service import email_clinic_logo, list_deliveries, queue_campaign_deliveries, retry_failed_deliveries, validate_template_variables, with_clinic_logo
from app.services.smtp_service import send_rendered_email


router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])

@router.get("/{campaign_id}/email-template", response_model=CampaignEmailTemplateResponse | None)
async def get_email_template(campaign_id: UUID, _: Annotated[User, Depends(require_permission("campaign.create"))], session: AsyncSession = Depends(get_db_session)) -> CampaignEmailTemplateResponse | None:
    await get_campaign_or_404(session, campaign_id)
    return await session.get(CampaignEmailTemplate, campaign_id)


@router.put("/{campaign_id}/email-template", response_model=CampaignEmailTemplateResponse)
async def save_email_template(campaign_id: UUID, payload: CampaignEmailTemplateRequest, actor: Annotated[User, Depends(require_permission("campaign.create"))], session: AsyncSession = Depends(get_db_session)) -> CampaignEmailTemplateResponse:
    campaign = await get_campaign_or_404(session, campaign_id)
    if campaign.status not in {CampaignStatus.DRAFT, CampaignStatus.SCHEDULED}:
        raise HTTPException(status_code=409, detail="Email templates cannot be changed after campaign activation")
    validate_template_variables(payload.subject, payload.html_body, payload.text_body)
    template = await session.get(CampaignEmailTemplate, campaign_id)
    if template and template.locked_at:
        raise HTTPException(status_code=409, detail="Email template is locked")
    if template is None:
        template = CampaignEmailTemplate(campaign_id=campaign_id, **payload.model_dump(), updated_by_user_id=actor.id); session.add(template)
    else:
        for key, value in payload.model_dump().items(): setattr(template, key, value)
        template.updated_by_user_id = actor.id
    await session.commit(); await session.refresh(template)
    return template


@router.post("/{campaign_id}/email-template/test", status_code=status.HTTP_204_NO_CONTENT)
async def test_email_template(campaign_id: UUID, payload: CampaignEmailTemplateTestRequest, actor: Annotated[User, Depends(require_permission("campaign.create"))], session: AsyncSession = Depends(get_db_session)) -> None:
    template = await session.get(CampaignEmailTemplate, campaign_id)
    campaign = await get_campaign_or_404(session, campaign_id)
    if template is None: raise HTTPException(status_code=409, detail="Save an email template before sending a test")
    clinic = await session.get(Clinic, campaign.clinic_id)
    values = {"{{recipient_name}}": "Max Mustermann", "{{survey_link}}": "https://example.invalid/umfrage", "{{clinic_name}}": clinic.name if clinic else "", "{{campaign_title}}": campaign.title}
    render = lambda value: __import__("functools").reduce(lambda text, pair: text.replace(*pair), values.items(), value)
    inline_logo = await email_clinic_logo(clinic)
    await send_rendered_email(session, payload.recipient_email, render(template.subject), with_clinic_logo(render(template.html_body), clinic, inline_logo), render(template.text_body), inline_logo=inline_logo)


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


@router.post("/{campaign_id}/send", status_code=status.HTTP_202_ACCEPTED, response_model=CampaignDeliveryQueueResponse)
async def send_campaign_endpoint(campaign_id: UUID, actor: Annotated[User, Depends(require_permission("campaign.send"))], session: AsyncSession = Depends(get_db_session)) -> CampaignDeliveryQueueResponse:
    return CampaignDeliveryQueueResponse(**await queue_campaign_deliveries(session, campaign_id, actor.id))


@router.get("/{campaign_id}/deliveries", response_model=list[CampaignDeliveryResponse])
async def list_campaign_deliveries_endpoint(campaign_id: UUID, _: Annotated[User, Depends(require_permission("campaign.send"))], session: AsyncSession = Depends(get_db_session)) -> list[CampaignDeliveryResponse]:
    await get_campaign_or_404(session, campaign_id)
    return [CampaignDeliveryResponse(id=delivery.id, recipient_id=recipient.recipient_id, display_name=person.display_name, email=person.email, status=delivery.status, attempt_count=delivery.attempt_count, queued_at=delivery.queued_at, sent_at=delivery.sent_at, last_error=delivery.last_error) for delivery, recipient, person in await list_deliveries(session, campaign_id)]


@router.post("/{campaign_id}/deliveries/retry-failed", response_model=CampaignDeliveryQueueResponse)
async def retry_failed_campaign_deliveries_endpoint(campaign_id: UUID, actor: Annotated[User, Depends(require_permission("campaign.send"))], session: AsyncSession = Depends(get_db_session)) -> CampaignDeliveryQueueResponse:
    return CampaignDeliveryQueueResponse(**await retry_failed_deliveries(session, campaign_id, actor.id))
