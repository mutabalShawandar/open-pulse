from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_permission
from app.db.session import get_db_session
from app.models import User
from app.schemas.survey import SurveyVersionClinicAssignmentResponse
from app.services.survey_service import (
    assign_version_to_workspace,
    list_workspace_version_assignments,
    unassign_version_from_workspace,
)


router = APIRouter(prefix="/api/v1/clinics/{clinic_id}/survey-versions", tags=["survey versions"])


@router.get("", response_model=list[SurveyVersionClinicAssignmentResponse])
async def list_clinic_survey_versions_endpoint(
    clinic_id: UUID,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> list[SurveyVersionClinicAssignmentResponse]:
    assignments = await list_workspace_version_assignments(session, clinic_id, actor)
    return [
        SurveyVersionClinicAssignmentResponse.model_validate(assignment, from_attributes=True)
        for assignment in assignments
    ]


@router.post(
    "/{survey_version_id}/assign",
    response_model=SurveyVersionClinicAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_clinic_survey_version_endpoint(
    clinic_id: UUID,
    survey_version_id: UUID,
    actor: Annotated[User, Depends(require_permission("survey.assign"))],
    session: AsyncSession = Depends(get_db_session),
) -> SurveyVersionClinicAssignmentResponse:
    assignment = await assign_version_to_workspace(session, clinic_id, survey_version_id, actor)
    return SurveyVersionClinicAssignmentResponse.model_validate(assignment, from_attributes=True)


@router.post("/{survey_version_id}/unassign", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_clinic_survey_version_endpoint(
    clinic_id: UUID,
    survey_version_id: UUID,
    actor: Annotated[User, Depends(require_permission("survey.assign"))],
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    await unassign_version_from_workspace(session, clinic_id, survey_version_id, actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
