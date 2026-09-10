import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.auth import LoginRequest, TokenResponse


async def login_with_keycloak(payload: LoginRequest) -> TokenResponse:
    token_url = (
        f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        "/protocol/openid-connect/token"
    )
    form = {
        "grant_type": "password",
        "client_id": settings.keycloak_client_id,
        "username": payload.username,
        "password": payload.password.get_secret_value(),
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            response = await client.post(token_url, data=form)
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Keycloak is unavailable",
        ) from error

    if response.status_code in (400, 401):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        response.raise_for_status()
        data = response.json()
        return TokenResponse(
            access_token=data["access_token"],
            token_type=data.get("token_type", "Bearer"),
            expires_in=data.get("expires_in"),
            refresh_token=data.get("refresh_token"),
        )
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Keycloak returned an invalid token response",
        ) from error
