from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings
from sqlalchemy import select, text
from uuid import UUID 
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db_session
from typing import Annotated
from app.api.deps import (
    get_current_user as get_authenticated_user,
    require_platform_admin,
    require_permission,
)
from app.models import User, Clinic
from app.schemas.user import PlatformAdminGrantResponse, UserCreateRequest, UserResponse
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.clinic import (
    ClinicCreateRequest,
    ClinicMemberCreateRequest,
    ClinicMemberResponse,
    ClinicResponse,
)
from app.services.keycloak_admin import KeycloakAdminClient
from app.services.user_service import create_platform_user, grant_platform_admin
from app.services.clinic_service import add_clinic_member, create_clinic
from app.services.auth_service import login_with_keycloak
from app.core.logging import configure_logging
from app.api.v1.surveys import router as surveys_router
from app.api.v1.clinic_survey_versions import router as clinic_survey_versions_router
from app.api.v1.administration import router as administration_router
from app.api.v1.campaigns import router as campaigns_router
from app.api.v1.public import router as public_router
from app.api.v1.analytics import router as analytics_router

is_dev = settings.app_env == "development"
configure_logging()

app = FastAPI(
    title="Umfrage Tool API",
    version="0.1.0",
    docs_url="/docs" if is_dev else None,
    redoc_url="/redoc" if is_dev else None,
    openapi_url="/openapi.json" if is_dev else None,
)
app.include_router(surveys_router)
app.include_router(clinic_survey_versions_router)
app.include_router(administration_router)
app.include_router(campaigns_router)
app.include_router(public_router)
app.include_router(analytics_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def limit_public_request_body(request: Request, call_next):
    """Reject oversized public payloads before Pydantic parses them."""
    if request.url.path.startswith("/api/v1/public/"):
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > 262_144:
            return JSONResponse(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, content={"detail": "Request body is too large"})
    return await call_next(request)


@app.post("/api/v1/auth/login", response_model=TokenResponse, tags=["auth"])
async def login(payload: LoginRequest) -> TokenResponse:
    if not is_dev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Development login is disabled",
        )
    return await login_with_keycloak(payload)


@app.post(
    "/api/v1/clinics",
    response_model=ClinicResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["clinic"],
)
async def create_clinic_endpoint(
    payload: ClinicCreateRequest,
    actor: Annotated[User, Depends(require_permission("clinic.create"))],
    session: AsyncSession = Depends(get_db_session),
) -> ClinicResponse:
    clinic = await create_clinic(session, payload, actor.id)
    return ClinicResponse.model_validate(clinic, from_attributes=True)

@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """
    Health check endpoint to verify that the API is running.
    """ 
    return {"status": "healthy"}

@app.get("/ready", tags=["system"])
async def ready(
    session: AsyncSession = Depends(get_db_session)
    ) -> dict[str, str]:
    """
    Readiness check endpoint to verify that the API is ready to handle requests.
    """
    try:
        # Execute a simple query to check database connectivity
        await session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable. Please check the database connection and try again.",
        )
        
    return {"status": "ready"}
    

@app.get("/api/v1/me", tags=["user"])
async def get_current_user(
    user: Annotated[User, Depends(get_authenticated_user)]
) -> dict:
    """
    Endpoint to retrieve the current local application user.
    """
    return {
            "id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
            "is_active": user.is_active,
         }


@app.post(
    "/api/v1/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["user"],
)
async def create_user(
    payload: UserCreateRequest,
    actor: Annotated[User, Depends(require_permission("user.manage"))],
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    user = await create_platform_user(
        session=session,
        payload=payload,
        keycloak=KeycloakAdminClient(),
        actor_user_id=actor.id,
    )

    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
    )


@app.post(
    "/api/v1/admin-users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["user"],
)
async def create_platform_admin_user(
    payload: UserCreateRequest,
    actor: Annotated[User, Depends(require_platform_admin)],
    session: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    user = await create_platform_user(
        session=session,
        payload=payload,
        keycloak=KeycloakAdminClient(),
        actor_user_id=actor.id,
        is_platform_admin=True,
    )
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
    )


@app.put(
    "/api/v1/users/{user_id}/roles/platform-admin",
    response_model=PlatformAdminGrantResponse,
    tags=["user"],
)
async def grant_platform_admin_role(
    user_id: UUID,
    actor: Annotated[User, Depends(require_platform_admin)],
    session: AsyncSession = Depends(get_db_session),
) -> PlatformAdminGrantResponse:
    user = await grant_platform_admin(session, user_id=user_id, actor_user_id=actor.id)
    return PlatformAdminGrantResponse(
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            is_active=user.is_active,
        ),
        is_platform_admin=True,
    )



@app.get("/api/v1/clinics/{clinic_id}", tags=["clinic"])
async def get_clinic(
    clinic_id: UUID,
    _: Annotated[User, Depends(get_authenticated_user)],
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    clinic = await session.scalar(select(Clinic).where(Clinic.id == clinic_id))

    if clinic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clinic not found.",
        )

    return {
        "id": str(clinic.id),
        "name": clinic.name,
        "slug": clinic.slug,
        "logo_url": clinic.logo_url,
        "street": clinic.street,
        "hausnummer": clinic.hausnummer,
        "city": clinic.city,
        "postal_code": clinic.postal_code,
        "created_at": clinic.created_at.isoformat(),
        "updated_at": clinic.updated_at.isoformat(),
    }


@app.post(
    "/api/v1/clinics/{clinic_id}/members",
    response_model=ClinicMemberResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["clinic"],
)
async def create_clinic_member(
    clinic_id: UUID,
    payload: ClinicMemberCreateRequest,
    actor: Annotated[User, Depends(require_permission("role.assign"))],
    session: AsyncSession = Depends(get_db_session),
) -> ClinicMemberResponse:
    membership = await add_clinic_member(
        session=session,
        clinic_id=clinic_id,
        payload=payload,
        actor_user_id=actor.id,
    )
    return ClinicMemberResponse(
        user_id=membership.user_id,
        clinic_id=membership.clinic_id,
        role_id=membership.role_id,
    )
