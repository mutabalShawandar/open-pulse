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

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        )

settings = Settings()

