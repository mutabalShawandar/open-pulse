# Project Instructions

## Teaching Mode

When the user asks to act as a teacher or to be guided as a beginner, explain each task in this order:

1. What we want to accomplish and why it matters.
2. How we will accomplish it, including the role of each part.
3. The code or commands to execute.

Proceed in small, verifiable steps and wait for confirmation before moving to the next step when practical.

## Project

OpenPulse is an open-source, English-first (with a German translation) multi-workspace survey platform for creating reusable surveys, distributing them through public links or email campaigns, collecting anonymous responses, and providing analytics and exports.

The scope of the first release (v0.1) is **local, self-hosted use on localhost with a single organization**. See [`README.md`](README.md) for the user-facing description and setup.

## Domain Boundaries

- Only human platform users authenticate, through Keycloak, which is identity-only. Identity, organizations, and authentication are planned to move to Zitadel in a later release; that is a large refactor, so treat the Keycloak integration and the current Organization model as transitional and do not deepen them without discussion.
- A valid Keycloak login alone must not grant application access; platform users are created or approved through an administrator-controlled workflow.
- The application database controls user roles, organization and workspace membership, permissions, surveys, campaigns, analytics, and audit history.
- An **Organization** is the tenant account. A **Workspace** (formerly "clinic") belongs to exactly one organization. Workspaces do not log in.
- A platform user may belong to multiple workspaces, and a workspace may have multiple users.
- Surveys are reusable and owned by an organization, not by a workspace. A published version can be assigned only to workspaces of the same organization.
- A campaign binds to one exact assigned `survey_version_id`, never to a mutable draft or "latest" version.
- Respondents and email recipients use public or campaign-specific survey links and do not need platform accounts.
- Public responses are anonymous only. Identified response mode is not implemented.

### Naming

The product term is **workspace**. For API compatibility the REST paths (`/api/v1/clinics/...`) and some identifiers (`clinic_manager`, `require_clinic_permission`) keep the old name. Do not rename them without a migration plan. In new code, UI text, and docs, say "workspace".

## Current State

- Backend (FastAPI, PostgreSQL, Alembic, Redis worker) and frontend (Next.js, next-intl) are feature-complete for the v0.1 scope: authentication and authorization, survey catalogue and builder, campaigns and public responses, recipient import and email delivery, analytics with PDF and Excel export.
- `docker compose up` starts everything, applies migrations, imports the local Keycloak realm, and seeds an administrator (`admin@openpulse.local`) plus a default SMTP configuration pointing at Mailpit. `docker compose --profile demo up` also seeds demo data.
- Self-serve organization registration exists but is disabled by default (`ORGANIZATION_REGISTRATION_ENABLED=false`). Multi-organization support is planned for a later release (see README).
- CI (GitHub Actions) runs backend lint, format check, and tests against Postgres and Mailpit; frontend lint, format check, type check, and build; a Docker Compose smoke test; CodeQL; and Snyk.
- Not production-ready. There is no supported production deployment. Encrypted backups, monitoring, retention jobs, and security and load testing are still open; see `docs/RELEASE_READINESS.md`.

## Working Conventions

- Backend: Python 3.14, `uv`, `ruff` (lint and format), `pytest`. Integration tests need PostgreSQL (and Mailpit for the delivery test); see the README for how to run them.
- Frontend: all user-facing text lives in `frontend/messages/en.json` and `frontend/messages/de.json` with identical key sets. Add keys to both files and do not hard-code strings in components or server actions. See `frontend/AGENTS.md`.
- Respondent-supplied text is untrusted. Exports must never turn it into formulas or markup (see `backend/app/services/export_service.py`).
- Ask before committing or pushing. Keep changes small and the app working at each step.

## Documentation

- [`README.md`](README.md): overview, scope, local setup, tests.
- [`backend/BACKEND_PLAN.md`](backend/BACKEND_PLAN.md): backend architecture, domain information, and the original implementation phases (historical).
- [`frontend/FRONTEND_PLAN.md`](frontend/FRONTEND_PLAN.md): frontend scope, architecture decisions, and session log.
- [`docs/`](docs): SMTP configuration, release-readiness checklist, and the original frontend handoff (historical).
- [`PROJECT_HISTORY.md`](PROJECT_HISTORY.md): where the project comes from.

## Deployment

Docker Compose at the repository root orchestrates the frontend, backend, worker, database, Redis, S3-compatible storage, Keycloak, and Mailpit for local use. There is no production Compose file.
