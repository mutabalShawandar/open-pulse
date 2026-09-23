from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ClinicMemberCreateRequest(BaseModel):
    user_id: UUID
    role_id: UUID


class ClinicMemberResponse(BaseModel):
    user_id: UUID
    clinic_id: UUID
    role_id: UUID
    user_email: str | None = None
    user_display_name: str | None = None
    role_name: str | None = None


class ClinicCreateRequest(BaseModel):
    name: str
    slug: str
    street: str | None = None
    hausnummer: int | None = None
    city: str | None = None
    postal_code: str | None = None


class ClinicUpdateRequest(BaseModel):
    name: str | None = None
    slug: str | None = None
    street: str | None = None
    hausnummer: int | None = None
    city: str | None = None
    postal_code: str | None = None


class ClinicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    logo_url: str | None
    street: str | None
    hausnummer: int | None
    city: str | None
    postal_code: str | None
