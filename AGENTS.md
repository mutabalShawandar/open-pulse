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

Phases 1 and 2 are complete.

Phase 1 delivered FastAPI health/readiness endpoints, PostgreSQL and Alembic setup, local Keycloak Compose configuration, Keycloak JWT extraction and validation, issuer/expiry/signature/audience checks, JWKS caching with timeouts, and a protected `/api/v1/me` endpoint. The local authorization schema includes `roles`, `permissions`, `role_permissions`, `user_roles`, and `clinic_members`; protected platform-user and clinic-management workflows, audit events, clinic-scoped authorization, and automated unit/integration tests are also in place.

Phase 2 delivered the agency survey catalogue and builder. Surveys are reusable agency-wide records rather than clinic-owned records. The backend supports multiple editable drafts, deep-copying drafts and whole surveys, immutable published versions, sections, typed questions, choice options, validation rules, ordering, archive/restore, published-version reads, and assigning published versions to clinics. A campaign in later phases must bind to one exact assigned `survey_version_id`, never to a mutable draft or “latest” version.

Current limitations: Phase 3 campaign creation, public survey links, response sessions/submission, rate limiting and public-endpoint abuse protection are not implemented. Recipient import, email delivery, analytics, exports, and production hardening remain later phases. Do not treat the current setup as production-ready.

Next work order: Phase 3 — Campaigns and Public Responses.

1. Add campaign, campaign branding, and campaign-to-clinic-to-published-version models.
2. Require campaign creation to select an active published-version assignment for its clinic.
3. Implement public campaign lookup through a non-guessable public slug.
4. Add secure public response sessions and typed answer persistence.
5. Validate and complete anonymous responses against the immutable survey version.
6. Add rate limiting, payload limits, token/slug safety, audit events, and automated integration tests.

## Documentation

Backend architecture, domain information, implementation phases, and the planned backend folder structure are documented in [`backend/BACKEND_PLAN.md`](backend/BACKEND_PLAN.md).

## Deployment

Docker Compose is managed at the repository root. It will orchestrate the frontend, backend, database, and supporting services so production can be started with one root-level Compose deployment.
