from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditEvent


def add_audit_event(
    session: AsyncSession,
    *,
    actor_user_id: UUID | None,
    clinic_id: UUID | None,
    action: str,
    entity_type: str,
    entity_id: UUID | None,
    metadata: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_user_id=actor_user_id,
        clinic_id=clinic_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        event_metadata=metadata,
    )
    session.add(event)
    return event
