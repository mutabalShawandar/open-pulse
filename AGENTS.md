# Project Instructions

## Teaching Mode

When the user asks to act as a teacher or to be guided as a beginner, explain each task in this order:

1. What we want to accomplish and why it matters.
2. How we will accomplish it, including the role of each part.
3. The code or commands to execute.

Proceed in small, verifiable steps and wait for confirmation before moving to the next step when practical.

## Project

This project is a German-language, multi-clinic survey platform for creating reusable surveys, distributing them through public links or email campaigns, collecting anonymous or identified responses, and providing analytics and exports.

## Domain Boundaries

- Only human platform users authenticate through Keycloak.
- Clinics are tenant records and do not log in during the current scope.
- A platform user may manage multiple clinics, and a clinic may have multiple platform users.
- The application database controls user roles, clinic assignments, permissions, surveys, campaigns, analytics, and audit history.
- Patients and email recipients use public or campaign-specific survey links and do not need platform accounts.
- A valid Keycloak login alone must not grant application access; platform users are created or approved through an administrator-controlled workflow.

## Current Progress

Phases 1–3 are complete. Phase 4 is in progress and currently has uncommitted work; do not describe its unfinished delivery workflow as released.

Phase 1 delivered FastAPI health/readiness endpoints, PostgreSQL and Alembic setup, local Keycloak Compose configuration, Keycloak JWT extraction and validation, issuer/expiry/signature/audience checks, JWKS caching with timeouts, and a protected `/api/v1/me` endpoint. The local authorization schema includes `roles`, `permissions`, `role_permissions`, `user_roles`, and `clinic_members`; protected platform-user and clinic-management workflows, audit events, clinic-scoped authorization, and automated unit/integration tests are also in place.

Phase 2 delivered the agency survey catalogue and builder. Surveys are reusable agency-wide records rather than clinic-owned records. The backend supports multiple editable drafts, deep-copying drafts and whole surveys, immutable published versions, sections, typed questions, choice options, validation rules, ordering, archive/restore, published-version reads, and assigning published versions to clinics. A campaign in later phases must bind to one exact assigned `survey_version_id`, never to a mutable draft or “latest” version.

Phase 3 delivered campaign branding and clinic-to-published-version binding, non-guessable public campaign links, secure anonymous response sessions and typed answer persistence, immutable-version validation/completion, public-endpoint payload limits and rate limiting, audit events, and automated tests.

Current limitations: identified response mode is not implemented; public responses are anonymous only. Phase 4 recipient import, campaign-recipient selection, SMTP configuration, templates, and delivery work is in progress and must be completed, tested, and committed before it is treated as available. Production hardening remains incomplete: encrypted automated backups, monitoring/error reporting, retention/deletion jobs, security/load testing, and a production VPS deployment and recovery runbook are required. Do not treat the current setup as production-ready.

Next work order: complete Phase 4, then perform Phase 6 production hardening.

1. Complete and commit recipient, template, durable delivery, retry, and delivery-status workflows.
2. Decide whether identified response mode is required for the first public release and implement it if so.
3. Verify campaign analytics and PDF/Excel export workflows against real completed responses.
4. Add production deployment, backup/restore, monitoring, retention, security, and load-test evidence before release.

## Documentation

Backend architecture, domain information, implementation phases, and the planned backend folder structure are documented in [`backend/BACKEND_PLAN.md`](backend/BACKEND_PLAN.md).

## Deployment

Docker Compose is managed at the repository root. It will orchestrate the frontend, backend, database, and supporting services so production can be started with one root-level Compose deployment.
