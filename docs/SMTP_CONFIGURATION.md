# SMTP configuration

The application supports one platform-managed SMTP connection for outbound campaign email. Incoming email is intentionally out of scope.

## Encryption key

SMTP passwords are encrypted with a Fernet key, `EMAIL_CREDENTIAL_ENCRYPTION_KEY`, which both the `backend` and `worker` services need. `.env.example` contains a key that is fine for local development only. For anything beyond that, generate your own once and keep it in a secret store:

```powershell
cd backend
.venv\Scripts\python.exe -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Do not rotate this key casually: existing SMTP passwords cannot be decrypted after a rotation. Use a planned credential migration if it must change. Never commit the key or SMTP password to Git.

## Administration workflow

1. Sign in as a platform administrator.
2. Open **Administration → Email delivery**.
3. Enter the sender address, SMTP host, port, TLS mode, and optional authentication credentials.
4. Save, then send a test email to a mailbox you control.

Passwords are encrypted using the deployment key before being stored. The read API returns only whether a password is configured; it never returns the password. Configuration changes and test sends create audit events without credential values or recipient addresses.

## Local development

On first start, the local Compose stack seeds a default SMTP configuration that points at Mailpit (`mailpit`, port `1025`, no TLS, no authentication, sender `no-reply@openpulse.local`). It is only created if no configuration exists yet, so changes you make in the UI are never overwritten. Open Mailpit's inbox at http://localhost:8025 to read the emails the application sends.
