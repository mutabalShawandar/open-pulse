from typing import Annotated

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.db.session import get_db_session
from app.models.identity import ExternalIdentityLink
from app.models.authorization import Permission, Role, RolePermission, UserRole

bearer_scheme = HTTPBearer(auto_error=False)
_jwks_cache: dict | None = None
_jwks_cache_expires_at = 0.0
_jwks_cache_seconds = 3600.0 # Cache JWKS for 1 hour to reduce the number of requests to Keycloak


async def get_bearer_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]
) -> str | None:
    """Reads the Bearer token from the Authorization header and returns it. 
    If the header is missing, 
    raises an HTTPException with a 401 status code.

    Args:
        credentials (Annotated[HTTPAuthorizationCredentials  |  None, Depends): The authorization credentials.

    Raises:
        HTTPException: _description_

    Returns:
        str | None: _description_
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return credentials.credentials

async def get_keycloak_jwks() -> dict:
    """Fetches the public key from Keycloak's JWKS endpoint.

    Raises:
        HTTPException: If the request to Keycloak fails or if the public key is not found.

    Returns:
        dict: The JWKS data.
    """
    global _jwks_cache, _jwks_cache_expires_at
    
    if _jwks_cache is not None and time.monotonic() < _jwks_cache_expires_at:
        return _jwks_cache
    
    jwks_url = (
        f"{settings.keycloak_internal_url}/realms/{settings.keycloak_realm}"
        "/protocol/openid-connect/certs"
    )
   
    try:
        timeout = httpx.Timeout(5.0)
        
        async with httpx.AsyncClient(timeout = timeout) as client:
            key_response = await client.get(jwks_url)
            key_response.raise_for_status()
            keys = key_response.json()
            
        _jwks_cache = keys
        _jwks_cache_expires_at = (
            time.monotonic() + _jwks_cache_seconds
            )

        return keys
        
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Keycloak service is unavailable or misconfigured",
        ) from e
        
        
async def get_current_claims(
    token: Annotated[str, Depends(get_bearer_token)],
) -> dict:
    """
    Validates the JWT token and returns the claims.

    Args:
        token (Annotated[str, Depends(get_bearer_token)]): The JWT token from the Authorization header.
        jwks (dict, optional): The JWKS data fetched from Keycloak. Defaults to Depends(get_keycloak_jwks).

    Raises:
        HTTPException: If the token is invalid or expired.
    """
    
    jwks = await get_keycloak_jwks()
    try:
        token_header = jwt.get_unverified_header(token)
        token_kid = token_header["kid"]
        
        signing_key = next(
            key for key in jwks["keys"] if key["kid"] == token_kid
        )
        
        claims = jwt.decode(
            token,
            jwt.PyJWK.from_dict(signing_key),
            algorithms=["RS256"],
            issuer=settings.keycloak_issuer,
            audience=settings.keycloak_audience,
            options={"verify_aud": True},
        )
        
        return claims
    except (jwt.PyJWTError, KeyError, StopIteration) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
           
           
async def get_current_user(
    claims: Annotated[dict, Depends(get_current_claims)],
    session: Annotated[AsyncSession, Depends(get_db_session)]
) -> User:
    
    subject = claims.get("sub")
    
    if not subject: 
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not contain a subject claim",
        )
        
        
    statement = (
        select(User)
        .join(
            ExternalIdentityLink, 
            ExternalIdentityLink.user_id == User.id
        )
        .where(
            ExternalIdentityLink.provider == "keycloak",
            ExternalIdentityLink.subject == subject,    
            User.is_active == True
        )
    )
    
    user = await session.scalar(statement)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not found or inactive",
        )

    return user


async def require_platform_admin(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> User:
    statement = (
        select(Role.id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == user.id,
            Role.name == "platform_admin",
        )
    )

    if await session.scalar(statement) is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrator permission required",
        )

    return user


def require_permission(permission_name: str):
    """Require a global permission granted through the local RBAC tables."""

    async def dependency(
        user: Annotated[User, Depends(get_current_user)],
        session: Annotated[AsyncSession, Depends(get_db_session)],
    ) -> User:
        statement = (
            select(Permission.id)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(UserRole, UserRole.role_id == RolePermission.role_id)
            .where(
                UserRole.user_id == user.id,
                Permission.name == permission_name,
            )
        )
        if await session.scalar(statement) is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission_name}",
            )
        return user

    return dependency
