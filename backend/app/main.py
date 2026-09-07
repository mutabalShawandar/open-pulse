from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import settings
from sqlalchemy import text 
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db_session
from typing import Annotated
from app.api.deps import get_current_claims

is_dev = settings.app_env == "development"

app = FastAPI(
    title="Umfrage Tool API",
    version="0.1.0",
    docs_url="/docs" if is_dev else None,
    redoc_url="/redoc" if is_dev else None,
    openapi_url="/openapi.json" if is_dev else None,
)

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
    claims: Annotated[dict, Depends(get_current_claims)]
) -> dict:
    """
    Endpoint to retrieve the current user's claims from the JWT token.
    """
    return {
            "subject": claims.get("sub"),
            "username": claims.get("preferred_username"),
            "email": claims.get("email"),
         }