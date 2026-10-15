import unittest

from pydantic import ValidationError

from app.schemas.recipient import RecipientCreateRequest, RecipientImportRequest, normalize_email


class NormalizeEmailTests(unittest.TestCase):
    def test_addresses_are_trimmed_and_lowercased(self) -> None:
        self.assertEqual(
            normalize_email("  Alex.Example@Example.COM \t"), "alex.example@example.com"
        )

    def test_plus_addressing_is_preserved(self) -> None:
        self.assertEqual(normalize_email("alex+survey@example.com"), "alex+survey@example.com")

    def test_malformed_addresses_are_rejected(self) -> None:
        for value in [
            "",
            "   ",
            "no-at-sign.example.com",
            "two@@example.com",
            "a@b@example.com",
            "@example.com",
            "alex@",
            "alex@localhost",
            "alex@example.com\r\nBcc: victim@example.net",
            "alex@exam\nple.com",
        ]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_email(value)


class RecipientCreateRequestTests(unittest.TestCase):
    def test_email_is_normalised_on_validation(self) -> None:
        self.assertEqual(RecipientCreateRequest(email=" A@B.com ").email, "a@b.com")

    def test_blank_display_names_become_none(self) -> None:
        self.assertIsNone(RecipientCreateRequest(email="a@b.com", display_name="   ").display_name)

    def test_display_name_is_trimmed(self) -> None:
        request = RecipientCreateRequest(email="a@b.com", display_name="  Alex  ")
        self.assertEqual(request.display_name, "Alex")

    def test_overlong_fields_are_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            RecipientCreateRequest(email="a@b.com", display_name="x" * 256)
        with self.assertRaises(ValidationError):
            RecipientCreateRequest(email="a" * 320 + "@b.com")


class RecipientImportRequestTests(unittest.TestCase):
    def test_an_empty_import_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            RecipientImportRequest(recipients=[])

    def test_import_size_is_capped_at_2000(self) -> None:
        row = {"email": "a@b.com"}
        RecipientImportRequest(recipients=[row] * 2000)
        with self.assertRaises(ValidationError):
            RecipientImportRequest(recipients=[row] * 2001)

    def test_one_invalid_row_rejects_the_whole_import(self) -> None:
        with self.assertRaises(ValidationError):
            RecipientImportRequest(recipients=[{"email": "a@b.com"}, {"email": "broken"}])


if __name__ == "__main__":
    unittest.main()
