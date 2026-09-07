from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]

class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str
    keycloak_url: str
    keycloak_realm: str
    keycloak_client_id: str
    keycloak_issuer: str

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env", 
        env_file_encoding="utf-8",
        extra="ignore",
        )

settings = Settings()

