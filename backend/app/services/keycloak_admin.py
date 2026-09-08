from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status

from app.core.config import settings


class KeycloakAdminClient:
    async def _get_admin_token(self, client: httpx.AsyncClient) -> str:
        if not settings.keycloak_admin_client_id or not settings.keycloak_admin_client_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Keycloak administration is not configured",
            )

        token_url = (
            f"{settings.keycloak_internal_url}/realms/{settings.keycloak_realm}"
            "/protocol/openid-connect/token"
        )
        token_response = await client.post(
            token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": settings.keycloak_admin_client_id,
                "client_secret": settings.keycloak_admin_client_secret,
            },
        )
        token_response.raise_for_status()
        return token_response.json()["access_token"]

    async def find_user_by_email(self, email: str) -> dict | None:
        """Find an existing Keycloak user without trusting a client-supplied subject."""
        admin_users_url = (
            f"{settings.keycloak_internal_url}/admin/realms/{settings.keycloak_realm}"
            "/users"
        )

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                admin_token = await self._get_admin_token(client)
                response = await client.get(
                    admin_users_url,
                    headers={"Authorization": f"Bearer {admin_token}"},
                    params={"email": email, "exact": "true"},
                )
                response.raise_for_status()
                users = response.json()

            if not users:
                return None
            if len(users) > 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Multiple Keycloak users match this email",
                )
            return users[0]
        except HTTPException:
            raise
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Keycloak administration is unavailable",
            ) from error

    async def create_user(
        self,
        *,
        email: str,
        display_name: str,
    ) -> str:
        admin_users_url = (
            f"{settings.keycloak_internal_url}/admin/realms/{settings.keycloak_realm}"
            "/users"
        )

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                admin_token = await self._get_admin_token(client)

                user_response = await client.post(
                    admin_users_url,
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={
                        "username": email,
                        "email": email,
                        "firstName": display_name,
                        "enabled": True,
                        "emailVerified": False,
                        "requiredActions": ["VERIFY_EMAIL", "UPDATE_PASSWORD"],
                    },
                )

                if user_response.status_code == status.HTTP_409_CONFLICT:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="A Keycloak user with this email already exists",
                    )

                user_response.raise_for_status()
                location = user_response.headers.get("Location")

                if not location:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Keycloak did not return the created user ID",
                    )

                subject = urlparse(location).path.rstrip("/").split("/")[-1]

                if not subject:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="Keycloak returned an invalid user location",
                    )

                return subject

        except HTTPException:
            raise
        except (httpx.HTTPError, KeyError, ValueError) as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Keycloak administration is unavailable",
            ) from error

    async def send_account_setup_email(self, subject: str) -> None:
        """Ask Keycloak to email verification and password-setup actions."""
        user_url = (
            f"{settings.keycloak_internal_url}/admin/realms/{settings.keycloak_realm}"
            f"/users/{subject}/execute-actions-email"
        )

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                admin_token = await self._get_admin_token(client)
                response = await client.put(
                    user_url,
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json=["VERIFY_EMAIL", "UPDATE_PASSWORD"],
                    params={"client_id": settings.keycloak_client_id},
                )
                response.raise_for_status()
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to send the account setup email",
            ) from error

    async def disable_user(self, subject: str) -> None:
        # Preserve the external identity for reconciliation and audit review.
        if not settings.keycloak_admin_client_id or not settings.keycloak_admin_client_secret:
            return

        user_url = (
            f"{settings.keycloak_internal_url}/admin/realms/{settings.keycloak_realm}"
            f"/users/{subject}"
        )

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                admin_token = await self._get_admin_token(client)

                response = await client.put(
                    user_url,
                    headers={"Authorization": f"Bearer {admin_token}"},
                    json={"enabled": False},
                )
                response.raise_for_status()
        except (httpx.HTTPError, KeyError, ValueError):
            # The original provisioning error remains the response. A later
            # reconciliation job should handle failed compensation.
            return
