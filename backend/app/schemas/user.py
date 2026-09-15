from pydantic import BaseModel, Field


class UserCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=255)


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None
    is_active: bool


class PlatformAdminGrantResponse(BaseModel):
    user: UserResponse
    is_platform_admin: bool
