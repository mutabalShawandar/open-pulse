import asyncio
import unittest
from types import SimpleNamespace

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.api import deps


def _token(*, audience: str = "umfrage-api") -> tuple[str, dict]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_numbers = private_key.public_key().public_numbers()
    jwk = {
        "kty": "RSA",
        "kid": "test-key",
        "n": jwt.utils.base64url_encode(
            public_numbers.n.to_bytes((public_numbers.n.bit_length() + 7) // 8, "big")
        ).decode(),
        "e": jwt.utils.base64url_encode(
            public_numbers.e.to_bytes((public_numbers.e.bit_length() + 7) // 8, "big")
        ).decode(),
    }
    token = jwt.encode(
        {"sub": "subject-1", "iss": deps.settings.keycloak_issuer, "aud": audience},
        private_key,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )
    return token, {"keys": [jwk], "private_key": private_key}


class SecurityDependencyTests(unittest.TestCase):
    def test_valid_keycloak_token_is_accepted(self) -> None:
        token, key_data = _token()
        original = deps.get_keycloak_jwks
        deps.get_keycloak_jwks = _async_return(key_data)
        try:
            claims = asyncio.run(deps.get_current_claims(token))
        finally:
            deps.get_keycloak_jwks = original

        self.assertEqual(claims["sub"], "subject-1")

    def test_wrong_audience_is_rejected(self) -> None:
        token, key_data = _token(audience="another-api")
        original = deps.get_keycloak_jwks
        deps.get_keycloak_jwks = _async_return(key_data)
        try:
            with self.assertRaises(HTTPException) as error:
                asyncio.run(deps.get_current_claims(token))
        finally:
            deps.get_keycloak_jwks = original

        self.assertEqual(error.exception.status_code, 401)

    def test_permission_dependency_rejects_missing_local_permission(self) -> None:
        dependency = deps.require_permission("survey.create")
        session = SimpleNamespace(scalar=_async_value(None))
        user = SimpleNamespace(id="user-1")

        with self.assertRaises(HTTPException) as error:
            asyncio.run(dependency(user, session))

        self.assertEqual(error.exception.status_code, 403)


def _async_value(value):
    async def result(*_args, **_kwargs):
        return value

    return result


def _async_return(value):
    async def result(*_args, **_kwargs):
        return value

    return result
