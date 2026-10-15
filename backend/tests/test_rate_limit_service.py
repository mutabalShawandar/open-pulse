import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from app.services.rate_limit_service import enforce_public_rate_limit


class FakeRedis:
    """In-memory stand-in for the subset of redis.asyncio.Redis the limiter uses."""

    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.expirations: dict[str, int] = {}
        self.closed = False

    async def incr(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    async def expire(self, key: str, seconds: int) -> None:
        self.expirations[key] = seconds

    async def aclose(self) -> None:
        self.closed = True


def request_from(host: str | None) -> SimpleNamespace:
    return SimpleNamespace(client=SimpleNamespace(host=host) if host else None)


class RateLimitTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.redis = FakeRedis()
        patcher = patch("app.services.rate_limit_service.Redis.from_url", return_value=self.redis)
        patcher.start()
        self.addCleanup(patcher.stop)

    async def test_requests_up_to_the_limit_are_allowed(self) -> None:
        for _ in range(3):
            await enforce_public_rate_limit(request_from("203.0.113.5"), "read", limit=3)

    async def test_request_over_the_limit_is_rejected_with_429(self) -> None:
        request = request_from("203.0.113.5")
        for _ in range(3):
            await enforce_public_rate_limit(request, "read", limit=3)
        with self.assertRaises(HTTPException) as context:
            await enforce_public_rate_limit(request, "read", limit=3)
        self.assertEqual(context.exception.status_code, 429)

    async def test_expiry_is_set_only_by_the_first_request_in_a_window(self) -> None:
        request = request_from("203.0.113.5")
        await enforce_public_rate_limit(request, "read")
        await enforce_public_rate_limit(request, "read")
        self.assertEqual(len(self.redis.expirations), 1)
        self.assertEqual(next(iter(self.redis.expirations.values())), 61)

    async def test_clients_and_buckets_are_counted_separately(self) -> None:
        await enforce_public_rate_limit(request_from("203.0.113.5"), "read", limit=1)
        await enforce_public_rate_limit(request_from("203.0.113.6"), "read", limit=1)
        await enforce_public_rate_limit(request_from("203.0.113.5"), "write", limit=1)
        self.assertEqual(len(self.redis.counts), 3)

    async def test_missing_client_address_is_still_limited(self) -> None:
        request = request_from(None)
        await enforce_public_rate_limit(request, "read", limit=1)
        with self.assertRaises(HTTPException):
            await enforce_public_rate_limit(request, "read", limit=1)
        self.assertTrue(any(":unknown:" in key for key in self.redis.counts))

    async def test_connection_is_closed_even_when_the_limit_is_exceeded(self) -> None:
        request = request_from("203.0.113.5")
        await enforce_public_rate_limit(request, "read", limit=1)
        with self.assertRaises(HTTPException):
            await enforce_public_rate_limit(request, "read", limit=1)
        self.assertTrue(self.redis.closed)

    async def test_stored_keys_never_contain_more_than_the_client_host_and_window(self) -> None:
        await enforce_public_rate_limit(request_from("203.0.113.5"), "read")
        (key,) = self.redis.counts
        self.assertRegex(key, r"^public-rate:read:203\.0\.113\.5:\d+$")


if __name__ == "__main__":
    unittest.main()
