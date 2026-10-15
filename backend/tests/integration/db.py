"""Shared helpers for PostgreSQL integration tests."""

import os
import unittest
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings

requires_database = unittest.skipUnless(
    os.getenv("TEST_DATABASE_URL") or os.getenv("APP_ENV") == "test",
    "Set APP_ENV=test with .env.test to run PostgreSQL integration tests",
)


@asynccontextmanager
async def rolled_back_session() -> AsyncIterator[AsyncSession]:
    """Yield a session whose changes, commits included, are rolled back afterwards."""
    engine = create_async_engine(os.getenv("TEST_DATABASE_URL", settings.database_url))
    try:
        async with engine.connect() as connection:
            transaction = await connection.begin()
            session = AsyncSession(bind=connection, expire_on_commit=False)
            try:
                yield session
            finally:
                await session.close()
                await transaction.rollback()
    finally:
        await engine.dispose()
