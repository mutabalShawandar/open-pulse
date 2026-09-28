"""Durable, privacy-safe campaign mail delivery orchestration."""

import html
import json
import re
import smtplib
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from redis.asyncio import Redis
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.links import build_public_survey_url
from app.models import Campaign, CampaignDelivery, CampaignEmailTemplate, CampaignRecipient, CampaignRecipientStatus, Workspace, Recipient, RecipientStatus
from app.models.campaign import CampaignStatus, generate_response_token, hash_response_token
from app.services.audit_service import add_audit_event
from app.services.campaign_service import assign_public_path
from app.services.smtp_service import get_smtp_configuration, send_campaign_email
from app.services.storage_service import read_workspace_logo

QUEUE_NAME = "campaign-deliveries"
TOKEN_KEY_PREFIX = "campaign-delivery-token:"
ALLOWED_TEMPLATE_VARIABLES = {"{{recipient_name}}", "{{survey_link}}", "{{clinic_name}}", "{{campaign_title}}"}
TOKEN_PATTERN = re.compile(r"{{[^{}]+}}")


def validate_template_variables(*values: str) -> None:
    variables = set().union(*(set(TOKEN_PATTERN.findall(value)) for value in values))
    if variables - ALLOWED_TEMPLATE_VARIABLES:
        raise HTTPException(status_code=422, detail="Unsupported email template variable")
    if "{{survey_link}}" not in values[1] and "{{survey_link}}" not in values[2]:
        raise HTTPException(status_code=422, detail="Email template must contain {{survey_link}}")


def render_template(value: str, variables: dict[str, str]) -> str:
    # Validation at save/queue time guarantees that this is substitution, not a template engine.
    for key, replacement in variables.items():
        value = value.replace(key, replacement)
    return value


async def email_workspace_logo(workspace: Workspace | None) -> tuple[bytes, str] | None:
    if workspace is None or not workspace.logo_storage_key:
        return None
    try:
        return await read_workspace_logo(workspace.logo_storage_key)
    except HTTPException:
        # A missing logo must not block delivery of a survey invitation.
        return None


def with_workspace_logo(html_body: str, workspace: Workspace | None, inline_logo: tuple[bytes, str] | None) -> str:
    """Add a CID-referenced workspace logo outside the editable email template."""
    if workspace is None or inline_logo is None:
        return html_body
    clinic_name = html.escape(workspace.name, quote=True)
    return f'<div style="padding:0 0 20px"><img src="cid:workspace-logo" alt="{clinic_name}" style="display:block;max-width:180px;max-height:80px;width:auto;height:auto" /></div>{html_body}'


def _safe_error(error: Exception) -> str:
    if isinstance(error, (smtplib.SMTPAuthenticationError, smtplib.SMTPRecipientsRefused)):
        return "SMTP-Authentifizierung oder Empfänger wurde abgelehnt"
    if isinstance(error, (TimeoutError, OSError, smtplib.SMTPException)):
        return "Temporärer SMTP-Übertragungsfehler"
    return "E-Mail konnte nicht versendet werden"


def is_transient_smtp_error(error: Exception) -> bool:
    if isinstance(error, (smtplib.SMTPAuthenticationError, smtplib.SMTPRecipientsRefused, smtplib.SMTPHeloError)):
        return False
    return isinstance(error, (TimeoutError, OSError, smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError, smtplib.SMTPDataError))


async def enqueue_delivery_jobs(jobs: list[tuple[UUID, str]]) -> None:
    if not jobs:
        return
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        for delivery_id, raw_token in jobs:
            await redis.set(f"{TOKEN_KEY_PREFIX}{delivery_id}", raw_token, ex=7 * 24 * 60 * 60)
            await redis.rpush(QUEUE_NAME, json.dumps({"delivery_id": str(delivery_id), "token": raw_token}))
    finally:
        await redis.aclose()


async def queue_campaign_deliveries(session: AsyncSession, campaign_id: UUID, actor_user_id: UUID) -> dict[str, int]:
    campaign = await session.scalar(select(Campaign).where(Campaign.id == campaign_id).with_for_update())
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in {CampaignStatus.DRAFT, CampaignStatus.SCHEDULED}:
        raise HTTPException(status_code=409, detail="Campaign cannot be queued in its current state")
    template = await session.scalar(select(CampaignEmailTemplate).where(CampaignEmailTemplate.campaign_id == campaign_id).with_for_update())
    if template is None:
        raise HTTPException(status_code=409, detail="Save a valid email template before queueing")
    if template.locked_at is not None:
        # A locked template is valid; repeat sends remain idempotent.
        pass
    validate_template_variables(template.subject, template.html_body, template.text_body)
    if await get_smtp_configuration(session) is None:
        raise HTTPException(status_code=409, detail="Configure outbound email before queueing")
    if campaign.public_path is None:
        await assign_public_path(session, campaign)

    rows = list(await session.execute(
        select(CampaignRecipient, Recipient)
        .join(Recipient, Recipient.id == CampaignRecipient.recipient_id)
        .where(CampaignRecipient.campaign_id == campaign_id)
        .with_for_update()
    ))
    jobs: list[tuple[UUID, str]] = []
    skipped = 0
    for campaign_recipient, recipient in rows:
        delivery = await session.scalar(select(CampaignDelivery).where(CampaignDelivery.campaign_recipient_id == campaign_recipient.id))
        if delivery is not None:
            skipped += 1
            continue
        if recipient.status != RecipientStatus.ACTIVE or campaign_recipient.status != CampaignRecipientStatus.PENDING:
            skipped += 1
            continue
        raw_token = generate_response_token()
        campaign_recipient.token_hash = hash_response_token(raw_token)
        campaign_recipient.status = CampaignRecipientStatus.QUEUED
        delivery = CampaignDelivery(campaign_recipient_id=campaign_recipient.id, idempotency_key=generate_response_token(), status="queued", queued_at=datetime.now(UTC))
        session.add(delivery)
        await session.flush()
        jobs.append((delivery.id, raw_token))
    if jobs and template.locked_at is None:
        template.locked_at = datetime.now(UTC)
    # Sending opens the survey to these recipients immediately, so the campaign goes straight
    # to active (never back to draft/scheduled — enforced in update_campaign).
    if jobs:
        campaign.status = CampaignStatus.ACTIVE
    add_audit_event(session, actor_user_id=actor_user_id, workspace_id=campaign.workspace_id, action="campaign.deliveries_queued", entity_type="campaign", entity_id=campaign.id, metadata={"queued_count": len(jobs), "skipped_count": skipped})
    await session.commit()
    await enqueue_delivery_jobs(jobs)
    return {"queued_count": len(jobs), "skipped_count": skipped}


async def list_deliveries(session: AsyncSession, campaign_id: UUID) -> list[tuple[CampaignDelivery, CampaignRecipient, Recipient]]:
    return list(await session.execute(
        select(CampaignDelivery, CampaignRecipient, Recipient)
        .join(CampaignRecipient, CampaignRecipient.id == CampaignDelivery.campaign_recipient_id)
        .join(Recipient, Recipient.id == CampaignRecipient.recipient_id)
        .where(CampaignRecipient.campaign_id == campaign_id)
        .order_by(CampaignDelivery.queued_at.desc())
    ))


async def retry_failed_deliveries(session: AsyncSession, campaign_id: UUID, actor_user_id: UUID) -> dict[str, int]:
    campaign = await session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status in {CampaignStatus.CANCELLED, CampaignStatus.COMPLETED, CampaignStatus.PAUSED}:
        raise HTTPException(status_code=409, detail="Campaign is not eligible for retry")
    rows = list(await session.execute(
        select(CampaignDelivery, CampaignRecipient)
        .join(CampaignRecipient)
        .where(CampaignRecipient.campaign_id == campaign_id, CampaignDelivery.status == "failed", CampaignRecipient.status == CampaignRecipientStatus.FAILED)
    ))
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    jobs: list[tuple[UUID, str]] = []
    try:
        for delivery, recipient in rows:
            raw_token = await redis.get(f"{TOKEN_KEY_PREFIX}{delivery.id}")
            if raw_token and recipient.token_hash == hash_response_token(raw_token):
                delivery.status = "queued"
                delivery.last_error = None
                recipient.status = CampaignRecipientStatus.QUEUED
                recipient.last_error = None
                jobs.append((delivery.id, raw_token))
    finally:
        await redis.aclose()
    add_audit_event(session, actor_user_id=actor_user_id, workspace_id=campaign.workspace_id, action="campaign.deliveries_requeued", entity_type="campaign", entity_id=campaign.id, metadata={"requeued_count": len(jobs), "skipped_count": len(rows) - len(jobs)})
    await session.commit()
    await enqueue_delivery_jobs(jobs)
    return {"requeued_count": len(jobs), "skipped_count": len(rows) - len(jobs)}


async def process_delivery_job(session: AsyncSession, delivery_id: UUID, raw_token: str) -> int:
    """Send one job. Returns the attempt number when the same token must retry."""
    delivery = await session.scalar(select(CampaignDelivery).where(CampaignDelivery.id == delivery_id).with_for_update())
    if delivery is None or delivery.status == "sent":
        return 0
    campaign_recipient = await session.get(CampaignRecipient, delivery.campaign_recipient_id)
    if campaign_recipient is None or campaign_recipient.token_hash != hash_response_token(raw_token):
        return 0
    campaign = await session.get(Campaign, campaign_recipient.campaign_id)
    recipient = await session.get(Recipient, campaign_recipient.recipient_id)
    if campaign is None or recipient is None:
        return 0
    if campaign.status in {CampaignStatus.CANCELLED, CampaignStatus.COMPLETED, CampaignStatus.PAUSED} or (campaign.ends_at is not None and campaign.ends_at <= datetime.now(UTC)):
        return 0
    if recipient.status != RecipientStatus.ACTIVE:
        delivery.status = "failed"
        delivery.last_error = "Empfänger ist nicht versandberechtigt"
        campaign_recipient.status = CampaignRecipientStatus.FAILED
        campaign_recipient.last_error = delivery.last_error
        await session.commit()
        return 0
    template = await session.get(CampaignEmailTemplate, campaign.id)
    if template is None:
        delivery.status = "failed"
        delivery.last_error = "E-Mail-Vorlage fehlt"
        campaign_recipient.status = CampaignRecipientStatus.FAILED
        campaign_recipient.last_error = delivery.last_error
        await session.commit()
        return 0
    delivery.status = "sending"
    delivery.attempt_count += 1
    delivery.last_error = None
    await session.commit()

    workspace = await session.get(Workspace, campaign.workspace_id)
    link = build_public_survey_url(workspace.slug if workspace else "umfrage", campaign.public_path or campaign.public_slug, raw_token)
    variables = {"{{recipient_name}}": recipient.display_name or "", "{{survey_link}}": link, "{{clinic_name}}": workspace.name if workspace else "", "{{campaign_title}}": campaign.title}
    try:
        inline_logo = await email_workspace_logo(workspace)
        html_body = with_workspace_logo(render_template(template.html_body, variables), workspace, inline_logo)
        await send_campaign_email(session, recipient.email, render_template(template.subject, variables), html_body, render_template(template.text_body, variables), sender_name=template.sender_name, reply_to=template.reply_to, inline_logo=inline_logo)
    except Exception as error:
        delivery = await session.get(CampaignDelivery, delivery_id)
        campaign_recipient = await session.get(CampaignRecipient, delivery.campaign_recipient_id) if delivery else None
        if delivery is None or campaign_recipient is None:
            return 0
        delivery.last_error = _safe_error(error)
        can_retry = is_transient_smtp_error(error) and delivery.attempt_count < settings.campaign_delivery_max_attempts
        delivery.status = "queued" if can_retry else "failed"
        campaign_recipient.status = CampaignRecipientStatus.QUEUED if can_retry else CampaignRecipientStatus.FAILED
        campaign_recipient.last_error = delivery.last_error
        add_audit_event(session, actor_user_id=None, workspace_id=campaign.workspace_id, action="campaign.delivery_retry_scheduled" if can_retry else "campaign.delivery_failed", entity_type="campaign_delivery", entity_id=delivery.id, metadata={"attempt_count": delivery.attempt_count})
        await session.commit()
        return delivery.attempt_count if can_retry else 0
    delivery = await session.get(CampaignDelivery, delivery_id)
    campaign_recipient = await session.get(CampaignRecipient, delivery.campaign_recipient_id) if delivery else None
    if delivery is None or campaign_recipient is None:
        return 0
    now = datetime.now(UTC)
    delivery.status = "sent"
    delivery.sent_at = now
    delivery.last_error = None
    campaign_recipient.status = CampaignRecipientStatus.SENT
    campaign_recipient.sent_at = now
    campaign_recipient.last_error = None
    add_audit_event(session, actor_user_id=None, workspace_id=campaign.workspace_id, action="campaign.delivery_sent", entity_type="campaign_delivery", entity_id=delivery.id, metadata={"attempt_count": delivery.attempt_count})
    await session.commit()
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        await redis.delete(f"{TOKEN_KEY_PREFIX}{delivery_id}")
    except (OSError, RedisConnectionError):
        # SMTP acceptance is already durable; expiry will remove the short-lived token later.
        pass
    finally:
        await redis.aclose()
    return 0
