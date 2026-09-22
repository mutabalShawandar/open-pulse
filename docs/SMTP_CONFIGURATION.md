# SMTP configuration

The application supports one platform-managed SMTP connection for outbound campaign email. Incoming email is intentionally out of scope.

## Deployment secret

Set a unique Fernet key as `EMAIL_CREDENTIAL_ENCRYPTION_KEY` for both the `backend` and `worker` services. Generate it once and store it in the production secret manager:

```powershell
cd backend
.venv\Scripts\python.exe -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Do not rotate this key casually: existing SMTP passwords cannot be decrypted after a rotation. Use a planned credential migration if it must change. Never commit the key or SMTP password to Git.

## Administration workflow

1. Sign in as a platform administrator.
2. Open **Administration → E-Mail-Versand**.
3. Enter the sender address, SMTP host, port, TLS mode, and optional authentication credentials.
4. Save, then send a test email to a mailbox you control.

Passwords are encrypted using the deployment key before being stored. The read API returns only whether a password is configured; it never returns the password. Configuration changes and test sends create audit events without credential values or recipient addresses.

For local Mailpit development, use `mailpit` as the SMTP host and port `1025` with no TLS or authentication. Mailpit's inbox is exposed on port `8025` by the local Compose stack.
