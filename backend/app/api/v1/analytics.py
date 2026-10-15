from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models import User
from app.schemas.analytics import CampaignAnalyticsResponse
from app.services.analytics_service import campaign_analytics
from app.services.audit_service import add_audit_event
from app.services.authorization_service import require_clinic_permission
from app.services.export_service import build_excel_export, build_pdf_export, export_report_data

router = APIRouter(prefix="/api/v1/clinics/{clinic_id}/analytics", tags=["analytics"])


@router.get("/campaigns/{campaign_id}", response_model=CampaignAnalyticsResponse)
async def campaign_analytics_endpoint(
    clinic_id: UUID,
    campaign_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> CampaignAnalyticsResponse:
    await require_clinic_permission(session, actor, clinic_id, "response.view")
    return CampaignAnalyticsResponse(**await campaign_analytics(session, clinic_id, campaign_id))


@router.get("/campaigns/{campaign_id}/export/{export_format}")
async def campaign_export_endpoint(
    clinic_id: UUID,
    campaign_id: UUID,
    export_format: str,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    await require_clinic_permission(session, actor, clinic_id, "response.view")
    if export_format not in {"pdf", "xlsx"}:
        raise HTTPException(status_code=404, detail="Export format not found")

    data = await export_report_data(session, clinic_id, campaign_id)
    if export_format == "pdf":
        content, filename = build_pdf_export(data)
        media_type = "application/pdf"
    else:
        content, filename = build_excel_export(data)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    add_audit_event(
        session,
        actor_user_id=actor.id,
        workspace_id=clinic_id,
        action="campaign.export",
        entity_type="campaign",
        entity_id=campaign_id,
        metadata={"format": export_format},
    )
    await session.commit()
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
