import io
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from PIL import Image

from app.core.config import settings
from app.services import storage_service
from app.services.storage_service import (
    MAX_LOGO_BYTES,
    read_workspace_logo,
    save_workspace_logo,
)


def image_bytes(image_format: str = "PNG", size: tuple[int, int] = (16, 16)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, "teal").save(buffer, format=image_format)
    return buffer.getvalue()


def upload(data: bytes) -> UploadFile:
    return UploadFile(file=io.BytesIO(data), filename="logo")


class SaveWorkspaceLogoTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.client = MagicMock()
        patcher = patch.object(storage_service, "_client", return_value=self.client)
        patcher.start()
        self.addCleanup(patcher.stop)

    async def test_valid_images_are_stored_with_a_matching_content_type(self) -> None:
        for image_format, media_type, extension in [
            ("PNG", "image/png", "png"),
            ("JPEG", "image/jpeg", "jpg"),
            ("WEBP", "image/webp", "webp"),
        ]:
            with self.subTest(image_format=image_format):
                self.client.reset_mock()
                workspace_id = uuid4()
                key, url = await save_workspace_logo(
                    workspace_id, upload(image_bytes(image_format))
                )
                self.assertTrue(key.startswith(f"clinic-logos/{workspace_id}/"))
                self.assertTrue(key.endswith(f".{extension}"))
                self.assertTrue(url.endswith(str(workspace_id)))
                stored = self.client.put_object.call_args.kwargs
                self.assertEqual(stored["ContentType"], media_type)
                self.assertEqual(stored["Key"], key)

    async def test_missing_bucket_is_created_before_the_upload(self) -> None:
        self.client.head_bucket.side_effect = Exception("NoSuchBucket")
        await save_workspace_logo(uuid4(), upload(image_bytes()))
        self.client.create_bucket.assert_called_once_with(Bucket=settings.minio_bucket)
        self.client.put_object.assert_called_once()

    async def test_file_over_the_size_limit_is_rejected_with_413(self) -> None:
        with self.assertRaises(HTTPException) as context:
            await save_workspace_logo(uuid4(), upload(b"0" * (MAX_LOGO_BYTES + 1)))
        self.assertEqual(context.exception.status_code, 413)
        self.client.put_object.assert_not_called()

    async def test_file_exactly_at_the_size_limit_is_not_rejected_for_size(self) -> None:
        with self.assertRaises(HTTPException) as context:
            await save_workspace_logo(uuid4(), upload(b"0" * MAX_LOGO_BYTES))
        # Not a valid image, so it fails validation, but not with 413.
        self.assertEqual(context.exception.status_code, 422)

    async def test_non_image_content_is_rejected_with_422(self) -> None:
        for name, data in [
            ("text", b"not an image"),
            ("empty", b""),
            ("html disguised as an image", b"<html><script>alert(1)</script></html>"),
            ("truncated png", image_bytes()[:20]),
        ]:
            with self.subTest(name):
                with self.assertRaises(HTTPException) as context:
                    await save_workspace_logo(uuid4(), upload(data))
                self.assertEqual(context.exception.status_code, 422)
        self.client.put_object.assert_not_called()

    async def test_image_formats_outside_the_allow_list_are_rejected(self) -> None:
        for image_format in ["GIF", "BMP", "TIFF"]:
            with self.subTest(image_format=image_format):
                with self.assertRaises(HTTPException) as context:
                    await save_workspace_logo(uuid4(), upload(image_bytes(image_format)))
                self.assertEqual(context.exception.status_code, 422)
        self.client.put_object.assert_not_called()

    async def test_oversized_dimensions_are_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            await save_workspace_logo(uuid4(), upload(image_bytes(size=(4001, 10))))
        self.assertEqual(context.exception.status_code, 422)
        self.assertIn("dimensions", context.exception.detail)
        self.client.put_object.assert_not_called()

    async def test_maximum_allowed_dimensions_are_accepted(self) -> None:
        await save_workspace_logo(uuid4(), upload(image_bytes(size=(4000, 10))))
        self.client.put_object.assert_called_once()


class StorageClientTests(unittest.IsolatedAsyncioTestCase):
    def test_client_requires_credentials(self) -> None:
        with (
            patch.object(settings, "minio_access_key", None),
            patch.object(settings, "minio_secret_key", None),
            self.assertRaises(HTTPException) as context,
        ):
            storage_service._client()
        self.assertEqual(context.exception.status_code, 503)

    async def test_read_returns_bytes_and_content_type(self) -> None:
        body = MagicMock()
        body.read.return_value = b"data"
        client = MagicMock()
        client.get_object.return_value = {"Body": body, "ContentType": "image/png"}
        with patch.object(storage_service, "_client", return_value=client):
            self.assertEqual(await read_workspace_logo("key"), (b"data", "image/png"))

    async def test_read_defaults_the_content_type(self) -> None:
        body = MagicMock()
        body.read.return_value = b"data"
        client = MagicMock()
        client.get_object.return_value = {"Body": body}
        with patch.object(storage_service, "_client", return_value=client):
            _, media_type = await read_workspace_logo("key")
        self.assertEqual(media_type, "application/octet-stream")

    async def test_read_maps_any_storage_failure_to_404(self) -> None:
        client = MagicMock()
        client.get_object.side_effect = Exception("NoSuchKey")
        with (
            patch.object(storage_service, "_client", return_value=client),
            self.assertRaises(HTTPException) as context,
        ):
            await read_workspace_logo("missing")
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
