from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.models import Workspace
from app.schemas.campaign import (
    PublicAnswerSaveRequest,
    PublicCampaignResponse,
    PublicResponseCompletionRequest,
    PublicResponseSessionResponse,
    PublicResponseStatusResponse,
)
from app.services.campaign_service import (
    complete_response,
    get_public_campaign,
    public_campaign_sections,
    save_answers,
    session_response_or_404,
    start_public_response,
)
from app.services.rate_limit_service import enforce_public_rate_limit
from app.services.storage_service import read_workspace_logo

router = APIRouter(prefix="/api/v1/public", tags=["public surveys"])


@router.get("/clinic-logos/{clinic_id}")
async def public_clinic_logo_endpoint(
    clinic_id: UUID, session: AsyncSession = Depends(get_db_session)
) -> Response:
    workspace = await session.get(Workspace, clinic_id)
    if workspace is None or workspace.logo_storage_key is None:
        raise HTTPException(status_code=404, detail="Logo not found")
    data, media_type = await read_workspace_logo(workspace.logo_storage_key)
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


async def public_read_limit(request: Request) -> None:
    await enforce_public_rate_limit(request, "read", limit=60)


async def public_write_limit(request: Request) -> None:
    await enforce_public_rate_limit(request, "write", limit=20)


@router.get(
    "/campaigns/{slug}",
    response_model=PublicCampaignResponse,
    dependencies=[Depends(public_read_limit)],
)
async def public_campaign_endpoint(
    slug: str, session: AsyncSession = Depends(get_db_session)
) -> PublicCampaignResponse:
    campaign = await get_public_campaign(session, slug)
    workspace = await session.get(Workspace, campaign.workspace_id)
    return PublicCampaignResponse(
        title=campaign.title,
        description=campaign.description,
        clinic_name=workspace.name if workspace else "",
        logo_url=workspace.logo_url if workspace else None,
        branding=campaign.branding,
        response_identity_mode=campaign.response_identity_mode,
        sections=await public_campaign_sections(session, campaign),
    )


@router.post(
    "/campaigns/{slug}/responses",
    response_model=PublicResponseSessionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(public_write_limit)],
)
async def start_response_endpoint(
    slug: str, session: AsyncSession = Depends(get_db_session)
) -> PublicResponseSessionResponse:
    campaign = await get_public_campaign(session, slug)
    token, response_session = await start_public_response(session, campaign)
    return PublicResponseSessionResponse(
        session_token=token, expires_at=response_session.expires_at
    )


@router.put(
    "/responses/{session_token}/answers",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(public_write_limit)],
)
async def save_answers_endpoint(
    session_token: str,
    payload: PublicAnswerSaveRequest,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    response = await session_response_or_404(session, session_token)
    await save_answers(session, response, payload.answers)


@router.post(
    "/responses/{session_token}/complete",
    response_model=PublicResponseStatusResponse,
    dependencies=[Depends(public_write_limit)],
)
async def complete_response_endpoint(
    session_token: str,
    payload: PublicResponseCompletionRequest,
    session: AsyncSession = Depends(get_db_session),
) -> PublicResponseStatusResponse:
    response = await complete_response(
        session, await session_response_or_404(session, session_token)
    )
    return PublicResponseStatusResponse(status=response.status, completed_at=response.completed_at)
