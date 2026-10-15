import os
import unittest
from datetime import UTC, datetime
from uuid import uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.models import (
    Campaign,
    CampaignDelivery,
    CampaignEmailTemplate,
    CampaignRecipient,
    CampaignRecipientStatus,
    CampaignStatus,
    Organization,
    Recipient,
    RecipientStatus,
    SmtpConfiguration,
    Survey,
    SurveyStatus,
    SurveyVersion,
    SurveyVersionStatus,
    Workspace,
)
from app.models.campaign import hash_response_token
from app.services.delivery_service import process_delivery_job


@unittest.skipUnless(
    os.getenv("TEST_DATABASE_URL") and os.getenv("MAILPIT_API_URL"),
    "Set TEST_DATABASE_URL and MAILPIT_API_URL to run Mailpit delivery integration tests",
)
class CampaignDeliveryMailpitTests(unittest.IsolatedAsyncioTestCase):
    async def test_worker_sends_html_and_never_persists_raw_token(self) -> None:
        engine = create_async_engine(os.environ["TEST_DATABASE_URL"])
        raw_token = f"mailpit-token-{uuid4()}"
        email = f"delivery-{uuid4()}@example.test"
        async with engine.connect() as connection:
            transaction = await connection.begin()
            session = AsyncSession(bind=connection, expire_on_commit=False)
            try:
                organization = Organization(
                    name="Mailpit Organization", slug=f"mailpit-org-{uuid4()}"
                )
                session.add(organization)
                await session.flush()
                clinic = Workspace(
                    name="Mailpit Klinik",
                    slug=f"mailpit-{uuid4()}",
                    organization_id=organization.id,
                )
                survey = Survey(
                    organization_id=organization.id,
                    title="Mailpit survey",
                    status=SurveyStatus.PUBLISHED,
                )
                session.add_all([clinic, survey])
                await session.flush()
                version = SurveyVersion(
                    survey_id=survey.id,
                    version_number=1,
                    status=SurveyVersionStatus.PUBLISHED,
                    published_at=datetime.now(UTC),
                )
                session.add(version)
                await session.flush()
                campaign = Campaign(
                    workspace_id=clinic.id,
                    survey_version_id=version.id,
                    title="Mailpit Kampagne",
                    status=CampaignStatus.SCHEDULED,
                )
                recipient = Recipient(
                    workspace_id=clinic.id,
                    display_name="Max Mustermann",
                    email=email,
                    email_normalized=email,
                    status=RecipientStatus.ACTIVE,
                )
                session.add_all([campaign, recipient])
                await session.flush()
                campaign_recipient = CampaignRecipient(
                    campaign_id=campaign.id,
                    recipient_id=recipient.id,
                    token_hash=hash_response_token(raw_token),
                    status=CampaignRecipientStatus.QUEUED,
                )
                session.add(campaign_recipient)
                await session.flush()
                delivery = CampaignDelivery(
                    campaign_recipient_id=campaign_recipient.id,
                    status="queued",
                    idempotency_key=uuid4().hex,
                    queued_at=datetime.now(UTC),
                )
                template = CampaignEmailTemplate(
                    campaign_id=campaign.id,
                    subject="Einladung {{campaign_title}}",
                    html_body='<p>Hallo {{recipient_name}}</p><a href="{{survey_link}}">Umfrage</a>',
                    text_body="Hallo {{recipient_name}}: {{survey_link}}",
                )
                smtp = SmtpConfiguration(
                    host="127.0.0.1",
                    port=1025,
                    use_starttls=False,
                    use_ssl=False,
                    username=None,
                    password_encrypted=None,
                    sender_name="Tests",
                    sender_email="tests@example.test",
                )
                session.add_all([delivery, template, smtp])
                await session.commit()

                should_retry = await process_delivery_job(session, delivery.id, raw_token)
                self.assertEqual(should_retry, 0)
                await session.refresh(delivery)
                await session.refresh(campaign_recipient)
                self.assertEqual(delivery.status, "sent")
                self.assertEqual(campaign_recipient.status, CampaignRecipientStatus.SENT)
                self.assertNotEqual(campaign_recipient.token_hash, raw_token)
                self.assertEqual(campaign_recipient.token_hash, hash_response_token(raw_token))
                self.assertNotIn(
                    raw_token,
                    str((await session.execute(select(CampaignRecipient.token_hash))).all()),
                )
                # A duplicate Redis job after SMTP acceptance must be a harmless no-op.
                self.assertEqual(await process_delivery_job(session, delivery.id, raw_token), 0)
            finally:
                await session.close()
                await transaction.rollback()
        async with httpx.AsyncClient(base_url=os.environ["MAILPIT_API_URL"], timeout=10) as client:
            response = await client.get("/api/v1/messages")
            response.raise_for_status()
            messages = response.json().get("messages", [])
        matching_messages = [message for message in messages if email in str(message)]
        self.assertEqual(len(matching_messages), 1)
        await engine.dispose()
