# Release readiness

This document defines the minimum evidence required to label a build as a production release. Environment-specific values are configured outside Git; do not add secrets, domains, or SMTP credentials to this repository.

## Current release blockers

- Complete, commit, and test the in-progress Phase 4 recipient and email-delivery changes.
- Run all PostgreSQL and Mailpit integration tests in a clean Compose environment; the normal unit suite skips them when those services are absent.
- Perform end-to-end browser tests for authentication/access denial, survey publication, clinic assignment, public anonymous completion, campaign delivery, analytics, and both export formats.
- Decide whether identified responses are required for version 1. The implemented public response flow is anonymous only.
- Complete the operational controls below before accepting real patient or recipient data.

## Production controls

- TLS terminates at a reverse proxy; only ports 80/443 are internet-facing. PostgreSQL, Redis, Keycloak administration, Mailpit, and internal backend ports remain on the private Docker network.
- Use production Keycloak (`start`), disable development endpoints, and configure exact redirect URIs and web origins.
- Supply unique production secrets through the deployment secret store: database password, Keycloak bootstrap/admin credentials, Keycloak client secret, and `EMAIL_CREDENTIAL_ENCRYPTION_KEY`. Rotate any development credential that has ever been used outside a local machine.
- Run `alembic upgrade head` as a one-off release step before starting application containers. Take a verified backup first.
- Automate encrypted database backups, test restore at least once before launch, and document retention, owner, frequency, and restore steps.
- Configure centralized structured logs, uptime/readiness monitoring, error reporting, and alert ownership. Logs must not contain answers, access tokens, SMTP passwords, or recipient addresses.
- Define and implement retention/deletion schedules for recipients, responses, exports, and audit records; complete the GDPR data-processing and access-model review.
- Run public-endpoint load and security tests, including token/slug guessing, rate-limit exhaustion, malformed oversized payloads, authorization boundaries, and dependency outage behavior.

## Release commands

Run these in CI and again against the candidate image:

```powershell
cd backend
uv run pytest
uv run alembic upgrade head

cd ..\frontend
npm ci
npm run lint
npm run build
```

Do not call a release successful merely because the unit tests pass: Compose-based integration tests and the operational controls above are mandatory release evidence.

## Latest local evidence

- Backend unit suite: 48 passed; 5 Compose-dependent integration tests skipped.
- Frontend: `npm.cmd run lint` and `npm.cmd run build` pass, including the standalone production output.
