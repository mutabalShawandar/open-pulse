from pydantic import BaseModel, SecretStr


class LoginRequest(BaseModel):
    username: str
    password: SecretStr


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int | None = None
    refresh_token: str | None = None
