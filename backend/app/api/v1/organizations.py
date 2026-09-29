from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.organization import OrganizationRegisterRequest, OrganizationResponse
from app.schemas.workspace import WorkspaceCreateRequest, WorkspaceResponse
from app.services.authorization_service import require_organization_permission
from app.services.keycloak_admin import KeycloakAdminClient
from app.services.organization_service import get_organization_by_slug, is_slug_available, register_organization
from app.services.rate_limit_service import enforce_public_rate_limit
from app.services.workspace_service import create_workspace


router = APIRouter(prefix="/api/v1/organizations", tags=["organizations"])


async def register_rate_limit(request: Request) -> None:
    await enforce_public_rate_limit(request, "organization_register", limit=5)


@router.post(
    "/register",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(register_rate_limit)],
)
async def register_organization_endpoint(
    payload: OrganizationRegisterRequest,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationResponse:
    organization = await register_organization(session, payload, KeycloakAdminClient())
    return OrganizationResponse.model_validate(organization, from_attributes=True)


@router.get("/slug-available/{slug}")
async def check_slug_available_endpoint(
    slug: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    return {"available": await is_slug_available(session, slug)}


@router.get("/by-slug/{slug}", response_model=OrganizationResponse)
async def get_organization_by_slug_endpoint(
    slug: str,
    _actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationResponse:
    # The slug is already public (it's the org's subdomain segment); this just
    # resolves it to the organization's id/name for the dashboard shell, and
    # is gated on authentication only to avoid an unauthenticated enumeration
    # endpoint, not because the slug itself is sensitive.
    organization = await get_organization_by_slug(session, slug)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return OrganizationResponse.model_validate(organization, from_attributes=True)


@router.post(
    "/{organization_id}/workspaces",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_organization_workspace_endpoint(
    organization_id: UUID,
    payload: WorkspaceCreateRequest,
    actor: Annotated[User, Depends(get_current_user)],
    session: AsyncSession = Depends(get_db_session),
) -> WorkspaceResponse:
    await require_organization_permission(session, actor, organization_id, "clinic.create")
    scoped_payload = payload.model_copy(update={"organization_id": organization_id})
    workspace = await create_workspace(session, scoped_payload, actor.id)
    return WorkspaceResponse.model_validate(workspace, from_attributes=True)
