"""Single-concurrency Redis consumer for durable campaign delivery jobs."""

import asyncio
import json
import logging
from uuid import UUID

from redis.asyncio import Redis
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError

from app.core.config import settings
from app.db.session import async_session_factory
from app.services.delivery_service import QUEUE_NAME, enqueue_delivery_jobs, process_delivery_job

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BLPOP_TIMEOUT_SECONDS = 5


async def run() -> None:
    # socket_timeout must exceed the BLPOP block timeout below, otherwise the client's own
    # socket read races the server-side block and raises redis.exceptions.TimeoutError on
    # every idle poll instead of BLPOP returning None as intended.
    redis = Redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=BLPOP_TIMEOUT_SECONDS + 5)
    try:
        while True:
            try:
                item = await redis.blpop(QUEUE_NAME, timeout=BLPOP_TIMEOUT_SECONDS)
            except (RedisTimeoutError, RedisConnectionError):
                # Benign idle-poll timeout or a transient connection hiccup; just retry.
                continue
            if item is None:
                continue
            _, payload = item
            try:
                job = json.loads(payload)
                delivery_id = UUID(job["delivery_id"])
                raw_token = job["token"]
                if not isinstance(raw_token, str) or len(raw_token) > 256:
                    continue
                async with async_session_factory() as session:
                    retry_attempt = await process_delivery_job(session, delivery_id, raw_token)
                if retry_attempt:
                    # The token stays only in this queue payload and worker memory.
                    await asyncio.sleep(min(settings.campaign_delivery_retry_base_seconds * (2 ** (retry_attempt - 1)), 300))
                    await enqueue_delivery_jobs([(delivery_id, raw_token)])
            except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                logger.warning("Discarded malformed campaign delivery job")
            except Exception:
                # Do not include queue payload in logs: it contains a bearer token.
                logger.exception("Campaign delivery worker failed while processing a job")
    finally:
        await redis.aclose()


if __name__ == "__main__":
    asyncio.run(run())
