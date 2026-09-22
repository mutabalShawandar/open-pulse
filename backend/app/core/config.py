from pathlib import Path
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]
TEST_ENV_FILE = ROOT_DIR / ".env.test"
ENV_FILE = TEST_ENV_FILE if os.getenv("APP_ENV") == "test" and TEST_ENV_FILE.exists() else ROOT_DIR / ".env"

class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str
    keycloak_url: str
    keycloak_internal_url: str
    keycloak_realm: str
    keycloak_client_id: str
    keycloak_issuer: str
    keycloak_admin_client_id: str | None = None
    keycloak_admin_client_secret: str | None = None
    redis_url: str = "redis://localhost:6379/0"
    public_frontend_url: str = "http://localhost:3000"
    public_backend_url: str = "http://localhost:8000"
    minio_endpoint: str = "http://minio:9000"
    minio_access_key: str | None = None
    minio_secret_key: str | None = None
    minio_bucket: str = "clinic-assets"
    # e.g. "domain.de" — when set, public survey links use "https://{clinic_slug}.{public_root_domain}/{public_slug}"
    # instead of "{public_frontend_url}/umfragen/{public_slug}". Requires wildcard DNS/TLS and the frontend's
    # subdomain-rewrite middleware to be in place.
    public_root_domain: str | None = None
    campaign_delivery_max_attempts: int = 3
    campaign_delivery_retry_base_seconds: int = 15
    cors_origins: str = "http://localhost:3000"
    # Matches clinic subdomains (e.g. "https://clinic-slug.domain.de") when PUBLIC_ROOT_DOMAIN
    # is in use, since those origins can't be listed individually in CORS_ORIGINS.
    cors_origin_regex: str | None = None
    # A Fernet key. Keep this in the deployment secret store, never in Git.
    email_credential_encryption_key: str | None = None

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        )

settings = Settings()
