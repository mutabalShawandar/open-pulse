import unittest
import re
from unittest.mock import patch

from app.core.config import settings
from app.core.links import build_public_survey_url, normalize_campaign_path


class PublicLinkTests(unittest.TestCase):
    def test_campaign_title_becomes_a_clean_public_path(self) -> None:
        self.assertEqual(normalize_campaign_path("Patienten-Zufriedenheit: März 2026"), "patienten-zufriedenheit-marz-2026")

    def test_subdomain_link_uses_the_readable_path_and_token(self) -> None:
        with patch.object(settings, "public_root_domain", "example.test"):
            self.assertEqual(
                build_public_survey_url("praxis-mitte", "patienten-zufriedenheit", "recipient-token"),
                "https://praxis-mitte.example.test/patienten-zufriedenheit?token=recipient-token",
            )

    def test_cors_allows_a_clinic_subdomain_of_the_public_root_domain(self) -> None:
        with patch.object(settings, "public_root_domain", "example.test"), patch.object(settings, "cors_origin_regex", "https://staging-app\\.example\\.test"):
            pattern = settings.effective_cors_origin_regex

        self.assertIsNotNone(pattern)
        self.assertIsNotNone(re.fullmatch(pattern or "", "https://praxis-mitte.example.test"))
        self.assertIsNone(re.fullmatch(pattern or "", "https://attacker.example.org"))
