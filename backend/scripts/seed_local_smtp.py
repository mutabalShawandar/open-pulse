"""Seed the default outbound SMTP configuration pointing at the local Mailpit container.

Idempotent: does nothing if an SMTP configuration already exists, so settings edited
in the UI are never overwritten. Local development only.
"""

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import async_session_factory
from app.models import SmtpConfiguration
from app.services.smtp_service import get_smtp_configuration


async def seed() -> None:
    async with async_session_factory() as session:
        if await get_smtp_configuration(session) is not None:
            print("SMTP configuration already exists; leaving it unchanged.")
            return
        session.add(
            SmtpConfiguration(
                host=os.getenv("SEED_SMTP_HOST", "mailpit"),
                port=int(os.getenv("SEED_SMTP_PORT", "1025")),
                use_starttls=False,
                use_ssl=False,
                username=None,
                password_encrypted=None,
                sender_name="OpenPulse",
                sender_email=os.getenv("SEED_SMTP_SENDER", "no-reply@openpulse.local"),
            )
        )
        await session.commit()
        print("Seeded default SMTP configuration (Mailpit).")


if __name__ == "__main__":
    asyncio.run(seed())
