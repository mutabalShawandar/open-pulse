from datetime import UTC, datetime, timedelta
import unittest

from app.models.campaign import Campaign, CampaignStatus
from app.schemas.campaign import CampaignCreateRequest
from app.services.campaign_service import _is_publicly_open, campaign_has_ended


class CampaignLifecycleTests(unittest.TestCase):
    def test_end_date_closes_public_access_at_the_exact_time(self) -> None:
        now = datetime(2026, 9, 22, 12, tzinfo=UTC)
        campaign = Campaign(status=CampaignStatus.ACTIVE, ends_at=now)

        self.assertTrue(campaign_has_ended(campaign, now))
        self.assertFalse(_is_publicly_open(campaign, now))

    def test_future_end_date_keeps_an_active_campaign_open(self) -> None:
        now = datetime(2026, 9, 22, 12, tzinfo=UTC)
        campaign = Campaign(status=CampaignStatus.ACTIVE, ends_at=now + timedelta(seconds=1))

        self.assertFalse(campaign_has_ended(campaign, now))
        self.assertTrue(_is_publicly_open(campaign, now))

    def test_campaign_end_date_requires_a_timezone(self) -> None:
        with self.assertRaises(ValueError):
            CampaignCreateRequest(
                clinic_id="00000000-0000-0000-0000-000000000001",
                survey_version_id="00000000-0000-0000-0000-000000000002",
                title="Test",
                ends_at=datetime(2026, 9, 22, 12),
            )
