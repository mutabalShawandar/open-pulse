import asyncio
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException

from app.schemas.auth import LoginRequest
from app.services.auth_service import login_with_keycloak


class FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "request failed",
                request=httpx.Request("POST", "http://keycloak"),
                response=httpx.Response(self.status_code),
            )


class FakeClient:
    def __init__(self, response=None, error=None, **_kwargs):
        self.response = response
        self.error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, *_args, **_kwargs):
        if self.error:
            raise self.error
        return self.response


class LoginServiceTests(unittest.TestCase):
    def test_invalid_credentials_return_401(self):
        def factory(**kwargs):
            return FakeClient(response=FakeResponse(401, {"error": "invalid_grant"}))

        with patch("app.services.auth_service.httpx.AsyncClient", factory):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(
                    login_with_keycloak(LoginRequest(username="dev-admin", password="wrong"))
                )

        self.assertEqual(error.exception.status_code, 401)

    def test_keycloak_unavailable_returns_503(self):
        def factory(**kwargs):
            return FakeClient(error=httpx.ConnectError("unavailable"))

        with patch("app.services.auth_service.httpx.AsyncClient", factory):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(
                    login_with_keycloak(LoginRequest(username="dev-admin", password="password"))
                )

        self.assertEqual(error.exception.status_code, 503)
