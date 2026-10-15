# Release readiness

OpenPulse v0.1 is a **local, self-hosted** release. It is not production-ready, and this repository ships no production deployment configuration. This document lists what would have to be true before anyone should run it with real respondent data on a public server. Environment-specific values are configured outside Git; never add secrets, domains, or SMTP credentials to this repository.

## What v0.1 does cover

Every pull request and every push to `main` runs, in GitHub Actions:

- **Backend:** `ruff check`, `ruff format --check`, `alembic upgrade head`, and the full `pytest` suite, including the PostgreSQL and Mailpit integration tests.
- **Frontend:** `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm run build`.
- **Compose smoke test** (`.github/scripts/compose-smoke.sh`): starts the whole stack with demo data, checks the seeded administrator and default SMTP settings, sends a campaign, and confirms the emails arrive in Mailpit.
- **Security scanning:** CodeQL, Snyk (when `SNYK_TOKEN` is configured), dependency review on pull requests, and Dependabot.

## Open before a production release

### Product

- Decide whether identified responses are required. The implemented public response flow is anonymous only.
- Verify analytics and the PDF and Excel exports against real completed responses, and add browser-level end-to-end tests for: authentication and access denial, survey publication, workspace assignment, public anonymous completion, campaign delivery, analytics, and both export formats.
- Add an in-app way to approve users and assign roles. Today a new user who has not been assigned a role cannot see the administration area, and role assignment is not exposed in the UI.

### Operations

- Terminate TLS at a reverse proxy; only ports 80 and 443 should be internet-facing. PostgreSQL, Redis, Keycloak administration, Mailpit, and internal backend ports stay on a private network.
- Run Keycloak in production mode (`start`, not `start-dev`), disable development endpoints, and configure exact redirect URIs and web origins. The committed local realm contains development credentials and must not be used.
- Supply unique secrets through a secret store: database password, Keycloak bootstrap and admin credentials, Keycloak client secrets, and `EMAIL_CREDENTIAL_ENCRYPTION_KEY`. The values in `.env.example` are for local use only.
- Run `alembic upgrade head` as a one-off release step, after a verified backup.
- Automate encrypted database backups, test a restore, and document retention, owner, frequency, and restore steps.
- Add centralized structured logs, uptime and readiness monitoring, error reporting, and alert ownership. Logs must not contain answers, access tokens, SMTP passwords, or recipient addresses.
- Define and implement retention and deletion schedules for recipients, responses, exports, and audit records, and complete the data-protection review that applies to your jurisdiction.
- Run load and security tests against the public endpoints: token and slug guessing, rate-limit exhaustion, malformed and oversized payloads, authorization boundaries, and dependency outages.

## Running the checks locally

```powershell
cd backend
uv sync --locked --all-groups
uv run ruff check .
uv run ruff format --check .
uv run pytest tests --ignore=tests/integration

cd ..\frontend
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run build
```

The integration tests need a migrated PostgreSQL database and, for the delivery test, Mailpit. The README explains how to run them.
