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

Phase 1 is in progress. Completed foundation work includes FastAPI health/readiness endpoints, PostgreSQL and Alembic setup, local Keycloak Compose configuration, Keycloak JWT extraction and validation, issuer/expiry/signature/audience checks, JWKS caching with timeouts, and a protected `/api/v1/me` endpoint.

The local authorization schema now includes `roles`, `permissions`, `role_permissions`, `user_roles`, and `clinic_members`. Initial roles and permissions are seeded through an Alembic migration. A protected `POST /api/v1/users` workflow has been added to create platform users through the Keycloak Admin API and then create the local user and external identity link.

Current limitations: the Keycloak Admin API service-account client is not configured yet; the development user has not been assigned the local `platform_admin` role; clinic authorization and audit logging are not implemented; and automated tests do not exist yet. Do not treat the current setup as production-ready.

Next work order:

1. Configure a Keycloak confidential service-account client with `manage-users` permission.
2. Assign the initial local `platform_admin` role to the development user.
3. Test `POST /api/v1/users` and its compensation behavior.
4. Implement permission and clinic-membership checks in the service layer.
5. Add audit events.
6. Add automated unit and integration tests with cleanup for temporary users.

## Documentation

Backend architecture, domain information, implementation phases, and the planned backend folder structure are documented in [`backend/BACKEND_PLAN.md`](backend/BACKEND_PLAN.md).

## Deployment

Docker Compose is managed at the repository root. It will orchestrate the frontend, backend, database, and supporting services so production can be started with one root-level Compose deployment.
