import asyncio
import unittest
from types import SimpleNamespace

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.api import deps


def _token(
    *,
    audience: str = "umfrage-api",
    issuer: str | None = None,
    expires_at: int | None = None,
) -> tuple[str, dict]:
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
    claims = {
        "sub": "subject-1",
        "iss": issuer or deps.settings.keycloak_issuer,
        "aud": audience,
    }
    if expires_at is not None:
        claims["exp"] = expires_at
    token = jwt.encode(
        claims,
        private_key,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )
    return token, {"keys": [jwk], "private_key": private_key}


class SecurityDependencyTests(unittest.TestCase):
    def test_missing_bearer_credentials_are_rejected(self) -> None:
        with self.assertRaises(HTTPException) as error:
            asyncio.run(deps.get_bearer_token(None))

        self.assertEqual(error.exception.status_code, 401)

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

    def test_wrong_issuer_is_rejected(self) -> None:
        token, key_data = _token(issuer="https://wrong.example/realms/Umfrage")
        original = deps.get_keycloak_jwks
        deps.get_keycloak_jwks = _async_return(key_data)
        try:
            with self.assertRaises(HTTPException) as error:
                asyncio.run(deps.get_current_claims(token))
        finally:
            deps.get_keycloak_jwks = original

        self.assertEqual(error.exception.status_code, 401)

    def test_expired_token_is_rejected(self) -> None:
        token, key_data = _token(expires_at=1)
        original = deps.get_keycloak_jwks
        deps.get_keycloak_jwks = _async_return(key_data)
        try:
            with self.assertRaises(HTTPException) as error:
                asyncio.run(deps.get_current_claims(token))
        finally:
            deps.get_keycloak_jwks = original

        self.assertEqual(error.exception.status_code, 401)

    def test_invalid_signature_is_rejected(self) -> None:
        token, key_data = _token()
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        token = jwt.encode(
            {"sub": "subject-1", "iss": deps.settings.keycloak_issuer, "aud": "umfrage-api"},
            other_key,
            algorithm="RS256",
            headers={"kid": "test-key"},
        )
        original = deps.get_keycloak_jwks
        deps.get_keycloak_jwks = _async_return(key_data)
        try:
            with self.assertRaises(HTTPException) as error:
                asyncio.run(deps.get_current_claims(token))
        finally:
            deps.get_keycloak_jwks = original

        self.assertEqual(error.exception.status_code, 401)

    def test_malformed_token_is_rejected(self) -> None:
        original = deps.get_keycloak_jwks
        deps.get_keycloak_jwks = _async_return({"keys": []})
        try:
            with self.assertRaises(HTTPException) as error:
                asyncio.run(deps.get_current_claims("not-a-jwt"))
        finally:
            deps.get_keycloak_jwks = original

        self.assertEqual(error.exception.status_code, 401)

    def test_unknown_signing_key_is_rejected(self) -> None:
        token, key_data = _token()
        key_data["keys"][0]["kid"] = "different-key"
        original = deps.get_keycloak_jwks
        deps.get_keycloak_jwks = _async_return(key_data)
        try:
            with self.assertRaises(HTTPException) as error:
                asyncio.run(deps.get_current_claims(token))
        finally:
            deps.get_keycloak_jwks = original

        self.assertEqual(error.exception.status_code, 401)

    def test_token_without_subject_is_rejected(self) -> None:
        session = SimpleNamespace(scalar=_async_value(None))
        with self.assertRaises(HTTPException) as error:
            asyncio.run(deps.get_current_user({}, session))

        self.assertEqual(error.exception.status_code, 401)

    def test_inactive_local_user_is_rejected(self) -> None:
        session = SimpleNamespace(scalar=_async_value(None))
        with self.assertRaises(HTTPException) as error:
            asyncio.run(deps.get_current_user({"sub": "inactive-subject"}, session))

        self.assertEqual(error.exception.status_code, 403)

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
