from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None


class PermissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_user_id: UUID | None
    clinic_id: UUID | None
    action: str
    entity_type: str
    entity_id: UUID | None
    created_at: datetime
