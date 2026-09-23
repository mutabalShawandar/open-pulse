import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.email import SmtpConfiguration
from app.schemas.email import SmtpConfigurationUpsertRequest
from app.services.audit_service import add_audit_event


def _cipher() -> Fernet:
    if not settings.email_credential_encryption_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Outbound email encryption is not configured")
    try:
        return Fernet(settings.email_credential_encryption_key.encode("utf-8"))
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Outbound email encryption is misconfigured") from error


def _decrypt_password(configuration: SmtpConfiguration) -> str | None:
    if configuration.password_encrypted is None:
        return None
    try:
        return _cipher().decrypt(configuration.password_encrypted.encode("utf-8")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError) as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stored outbound email credentials cannot be decrypted") from error


async def get_smtp_configuration(session: AsyncSession) -> SmtpConfiguration | None:
    return await session.scalar(select(SmtpConfiguration).order_by(SmtpConfiguration.created_at).limit(1))


async def save_smtp_configuration(session: AsyncSession, payload: SmtpConfigurationUpsertRequest, actor_user_id) -> SmtpConfiguration:
    configuration = await get_smtp_configuration(session)
    values = payload.model_dump(exclude={"password"})
    if configuration is None:
        if payload.username and payload.password is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="An SMTP password is required when configuring authentication")
        configuration = SmtpConfiguration(**values, updated_by_user_id=actor_user_id)
        session.add(configuration)
    else:
        for field, value in values.items():
            setattr(configuration, field, value)
        configuration.updated_by_user_id = actor_user_id
    if payload.password is not None:
        configuration.password_encrypted = _cipher().encrypt(payload.password.encode("utf-8")).decode("utf-8")
    elif payload.username is None:
        configuration.password_encrypted = None
    add_audit_event(session, actor_user_id=actor_user_id, clinic_id=None, action="smtp_configuration.saved", entity_type="smtp_configuration", entity_id=configuration.id, metadata={"host": configuration.host, "port": configuration.port, "sender_email": configuration.sender_email})
    await session.commit()
    await session.refresh(configuration)
    return configuration


def _send_message_sync(configuration: SmtpConfiguration, recipient_email: str, subject: str, html_body: str, text_body: str, *, sender_name: str | None = None, reply_to: str | None = None, inline_logo: tuple[bytes, str] | None = None) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((sender_name or configuration.sender_name, configuration.sender_email))
    message["To"] = recipient_email
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    if inline_logo is not None:
        logo_data, media_type = inline_logo
        maintype, _, subtype = media_type.partition("/")
        if not subtype:
            maintype, subtype = "application", "octet-stream"
        message.get_payload()[-1].add_related(logo_data, maintype=maintype, subtype=subtype, cid="clinic-logo", filename=f"clinic-logo.{subtype}", disposition="inline")
    context = ssl.create_default_context()
    client: smtplib.SMTP | smtplib.SMTP_SSL
    client = smtplib.SMTP_SSL(configuration.host, configuration.port, timeout=20, context=context) if configuration.use_ssl else smtplib.SMTP(configuration.host, configuration.port, timeout=20)
    try:
        client.ehlo()
        if configuration.use_starttls:
            client.starttls(context=context)
            client.ehlo()
        if configuration.username:
            password = _decrypt_password(configuration)
            if password is None:
                raise RuntimeError("SMTP authentication password is missing")
            client.login(configuration.username, password)
        client.send_message(message)
    finally:
        try:
            client.quit()
        except (OSError, smtplib.SMTPException):
            client.close()


async def send_campaign_email(session: AsyncSession, recipient_email: str, subject: str, html_body: str, text_body: str, *, sender_name: str | None = None, reply_to: str | None = None, inline_logo: tuple[bytes, str] | None = None) -> None:
    configuration = await get_smtp_configuration(session)
    if configuration is None:
        raise RuntimeError("SMTP configuration is missing")
    await asyncio.to_thread(_send_message_sync, configuration, recipient_email, subject, html_body, text_body, sender_name=sender_name, reply_to=reply_to, inline_logo=inline_logo)


async def send_rendered_email(session: AsyncSession, recipient_email: str, subject: str, html_body: str, text_body: str, *, inline_logo: tuple[bytes, str] | None = None) -> None:
    try:
        await send_campaign_email(session, recipient_email, subject, html_body, text_body, inline_logo=inline_logo)
    except (OSError, smtplib.SMTPException, RuntimeError) as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The SMTP server rejected the test email") from error


async def send_smtp_test_email(session: AsyncSession, recipient_email: str, actor_user_id) -> None:
    try:
        await send_campaign_email(session, recipient_email, "Test der E-Mail-Konfiguration – Praxisumfragen", "<p>Die SMTP-Konfiguration von Praxisumfragen funktioniert.</p>", "Die SMTP-Konfiguration von Praxisumfragen funktioniert. Diese Nachricht wurde als Verbindungstest versendet.")
    except (OSError, smtplib.SMTPException, RuntimeError) as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The SMTP server rejected the test email") from error
    configuration = await get_smtp_configuration(session)
    add_audit_event(session, actor_user_id=actor_user_id, clinic_id=None, action="smtp_configuration.test_sent", entity_type="smtp_configuration", entity_id=configuration.id if configuration else None, metadata={"recipient_domain": recipient_email.rsplit("@", 1)[-1]})
    await session.commit()
