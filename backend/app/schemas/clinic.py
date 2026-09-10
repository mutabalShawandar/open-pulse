from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ClinicMemberCreateRequest(BaseModel):
    user_id: UUID
    role_id: UUID


class ClinicMemberResponse(BaseModel):
    user_id: UUID
    clinic_id: UUID
    role_id: UUID


class ClinicCreateRequest(BaseModel):
    name: str
    slug: str
    logo_url: str | None = None
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
