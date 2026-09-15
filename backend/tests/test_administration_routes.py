import unittest

from app.main import app


class AdministrationRouteTests(unittest.TestCase):
    def test_frontend_admin_api_routes_are_registered(self) -> None:
        paths = app.openapi()["paths"]
        expected = {
            ("/api/v1/clinics", "GET"),
            ("/api/v1/clinics/{clinic_id}", "PATCH"),
            ("/api/v1/clinics/{clinic_id}/members", "GET"),
            ("/api/v1/clinics/{clinic_id}/members/{user_id}", "DELETE"),
            ("/api/v1/users", "GET"),
            ("/api/v1/users/{user_id}", "GET"),
            ("/api/v1/users/{user_id}/deactivate", "POST"),
            ("/api/v1/roles", "GET"),
            ("/api/v1/permissions", "GET"),
            ("/api/v1/audit-events", "GET"),
        }
        actual = {
            (path, method.upper())
            for path, operations in paths.items()
            for method in operations
        }
        self.assertTrue(expected.issubset(actual))
