from typing import Annotated

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

async def get_bearer_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]
) -> str | None:
    """Reads the Bearer token from the Authorization header and returns it. 
    If the header is missing, 
    raises an HTTPException with a 401 status code.

    Args:
        credentials (Annotated[HTTPAuthorizationCredentials  |  None, Depends): _description_

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
    discovery_url = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/.well-known/openid-configuration"
   
    try:
        async with httpx.AsyncClient() as client:
            discovery_response = await client.get(discovery_url)
            discovery_response.raise_for_status()
            discovery = discovery_response.json()
            
            key_response = await client.get(discovery["jwks_uri"])
            key_response.raise_for_status()
        
        return key_response.json()
    except (httpx.HTTPError, KeyError) as e:
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
            options={"verify_aud": False},
        )
        
        return claims
    except (jwt.PyJWTError, KeyError, StopIteration) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
           
