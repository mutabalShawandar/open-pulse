import smtplib
import unittest

from fastapi import HTTPException

from app.services.delivery_service import (
    is_transient_smtp_error,
    render_template,
    validate_template_variables,
)


class DeliveryTemplateTests(unittest.TestCase):
    def test_only_allowlisted_variables_are_accepted(self) -> None:
        validate_template_variables(
            "{{campaign_title}}",
            '<a href="{{survey_link}}">Link</a>',
            "{{recipient_name}} {{clinic_name}}",
        )
        with self.assertRaises(HTTPException) as error:
            validate_template_variables("{{password}}", "{{survey_link}}", "Text")
        self.assertEqual(error.exception.status_code, 422)

    def test_survey_link_is_required(self) -> None:
        with self.assertRaises(HTTPException) as error:
            validate_template_variables("Betreff", "<p>Hallo</p>", "Hallo")
        self.assertEqual(error.exception.status_code, 422)

    def test_rendering_is_plain_allowlisted_substitution(self) -> None:
        self.assertEqual(
            render_template("Hallo {{recipient_name}}", {"{{recipient_name}}": "Max"}), "Hallo Max"
        )

    def test_only_transient_smtp_errors_are_retryable(self) -> None:
        self.assertTrue(is_transient_smtp_error(TimeoutError()))
        self.assertTrue(is_transient_smtp_error(smtplib.SMTPServerDisconnected("lost")))
        self.assertFalse(is_transient_smtp_error(smtplib.SMTPAuthenticationError(535, b"denied")))
