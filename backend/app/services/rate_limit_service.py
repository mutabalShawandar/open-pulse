import time

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis

from app.core.config import settings


async def enforce_public_rate_limit(request: Request, bucket: str, limit: int = 30) -> None:
    """Apply a fixed one-minute Redis limit without retaining public IP history."""
    client_host = request.client.host if request.client else "unknown"
    now = int(time.time())
    key = f"public-rate:{bucket}:{client_host}:{now // 60}"
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 61)
        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Please try again later"
            )
    finally:
        await redis.aclose()
