import os
import unittest

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy.ext.asyncio import create_async_engine

import app.models  # noqa: F401  (registers every model on Base.metadata)
from app.core.config import settings
from app.db.base import Base


@unittest.skipUnless(
    os.getenv("TEST_DATABASE_URL") or os.getenv("APP_ENV") == "test",
    "Set APP_ENV=test with .env.test to run PostgreSQL integration tests",
)
class MigrationsMatchModelsTests(unittest.IsolatedAsyncioTestCase):
    async def test_migrated_schema_has_no_drift_from_the_models(self) -> None:
        """The database built by `alembic upgrade head` must equal what the models declare.

        When this fails, a model changed without a migration (or the other way round). Create a
        migration with `alembic revision --autogenerate`, review it, and commit it with the change.
        """
        engine = create_async_engine(os.getenv("TEST_DATABASE_URL", settings.database_url))
        try:
            async with engine.connect() as connection:
                differences = await connection.run_sync(
                    lambda sync_connection: compare_metadata(
                        MigrationContext.configure(sync_connection), Base.metadata
                    )
                )
        finally:
            await engine.dispose()
        self.assertEqual(differences, [], f"Schema drift detected: {differences}")


if __name__ == "__main__":
    unittest.main()
