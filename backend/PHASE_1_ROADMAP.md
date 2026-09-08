# Phase 1 Roadmap: Backend Foundation

This checklist takes the backend from the current local FastAPI setup to a secure, database-backed foundation ready for survey development.

## Current Baseline

- FastAPI runs locally through uv.
- Python is pinned to 3.14.
- PostgreSQL runs in Docker on host port 5433.
- The backend loads configuration from the root .env.
- SQLAlchemy and asyncpg are installed.
- /health and /ready endpoints exist.

Use this command pattern from the backend directory:

~~~powershell
cd C:\Users\OmarTrabulsi\umfrage_reintjes\backend
uv run <command>
~~~

## Completion Criteria

Phase 1 is complete when:

- The backend starts reproducibly with uv.
- PostgreSQL is started by the root Compose file.
- Configuration is loaded centrally and secrets are not committed.
- SQLAlchemy connects to PostgreSQL asynchronously.
- Alembic can create and apply migrations.
- Keycloak authenticates human platform users through OpenID Connect; clinics do not authenticate.
- FastAPI validates Keycloak access tokens.
- Clinic membership and application permissions are enforced.
- Audit events are recorded for security-sensitive actions.
- Automated tests cover health, database, authentication, authorization, and clinic boundaries.

## Step 0: Repository Baseline

### Goal

Make the project reproducible before adding application functionality.

### Actions

- Keep one Git repository at the project root.
- Track backend/pyproject.toml, backend/uv.lock, and backend/.python-version.
- Ignore .venv/, .env, caches, logs, and generated files.
- Commit the current working state.

### Check

~~~powershell
git status
git add .
git commit -m "Initialize backend foundation"
~~~

## Step 1: Backend Structure

### Goal

Create the separation-of-concerns structure before adding more code.

~~~text
backend/app/
├── api/
│   ├── deps.py
│   └── v1/
├── core/
├── db/
│   └── migrations/
├── models/
├── repositories/
├── schemas/
├── services/
├── workers/
└── integrations/
~~~

### Rules

- API routes handle HTTP concerns only.
- Services contain business rules and authorization decisions.
- Repositories contain database queries.
- Models contain persistence mappings.
- Schemas contain request and response validation.
- Configuration is loaded only through app.core.config.
- Routes must not contain raw SQL.
- Responses must never expose passwords, tokens, or secrets.

### Check

~~~powershell
uv run python -c "from app.main import app; print(app.title)"
~~~

## Step 2: Centralized Configuration

### Goal

Load the root .env locally and injected environment variables in Docker.

Required settings:

- APP_ENV
- DATABASE_URL
- Later: Keycloak issuer, audience, and client settings
- Later: Redis and storage settings

Use pydantic-settings in app/core/config.py and instantiate it once with settings = Settings().

Do not use os.getenv() throughout the application or pass production values directly to Settings().

Local configuration:

~~~env
APP_ENV=development
DATABASE_URL=postgresql+asyncpg://umfrage_user:umfrage_password@127.0.0.1:5433/umfrage
~~~

### Check

~~~powershell
uv run python -c "from app.core.config import settings; print(settings.app_env); print(bool(settings.database_url))"
~~~

## Step 3: Liveness and Readiness

### Goal

Make service monitoring meaningful.

- /health confirms that the FastAPI process is alive.
- /ready confirms that required dependencies are available.

/health must not query the database. /ready must execute SELECT 1 through the shared SQLAlchemy session.

Rules:

- Return HTTP 200 when ready.
- Return HTTP 503 when PostgreSQL is unavailable.
- Do not expose credentials or internal details.
- Keep health routes separate from administrative routes.

### Check

~~~powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/ready
~~~

## Step 4: PostgreSQL Compose Service

### Goal

Run PostgreSQL consistently without installing it on the host.

The root docker-compose.yml should define postgres with:

- A pinned PostgreSQL major version
- Environment variables from root .env
- A named persistent volume
- A pg_isready health check
- Local mapping 5433:5432

### Check

~~~powershell
cd C:\Users\OmarTrabulsi\umfrage_reintjes
docker compose config
docker compose up -d postgres
docker compose ps
docker compose exec postgres pg_isready -U umfrage_user -d umfrage
~~~

The database password is initialized only when the volume is first created. Never delete a production volume to fix credentials.

## Step 5: SQLAlchemy Database Layer

### Goal

Provide one asynchronous engine and one session dependency.

Create:

~~~text
app/db/session.py
app/db/base.py
~~~

Requirements:

- Use create_async_engine.
- Use async_sessionmaker.
- Enable pool_pre_ping=True.
- Keep session creation in one module.
- Use dependency injection in routes.
- Do not create an engine per request.
- Do not expose database credentials in logs.

### Check

/ready must execute SELECT 1 through SQLAlchemy and return 200 only when PostgreSQL is available.

## Step 6: Alembic Migrations

### Goal

Track every schema change as a migration.

Initialize from backend:

~~~powershell
uv run alembic init app/db/migrations
~~~

Configure Alembic to read the database URL from application settings, use the async PostgreSQL engine, and import metadata from app.db.base.

Rules:

- Never edit an already-applied migration.
- Use descriptive migration names.
- Review generated migrations before applying them.
- Test upgrade and downgrade where supported.

### Check

~~~powershell
uv run alembic current
uv run alembic upgrade head
~~~

## Step 7: Local Authorization Tables

### Goal

Create application authorization without implementing identity management.

Initial tables:

- users
- external_identity_links
- clinics
- clinic_members
- roles
- permissions
- role_permissions
- user_roles

Keycloak identifies human platform users only. Clinics are tenant records and do not authenticate. A platform user can manage multiple clinics, and each clinic can have multiple platform users. These local tables determine which users can access each clinic and what they can do. Patients and email recipients do not need platform accounts.

The platform administrator manages user creation, global roles, and user-to-clinic assignments. Clinic accounts are intentionally out of scope for Phase 1.

Do not grant application access to every valid Keycloak user automatically. Provisioning must be initiated or approved by a platform administrator.

Platform user creation must go through Keycloak's Admin REST API or administrative CLI (`kcadm`). Only after Keycloak returns a successful subject should the backend create the local user and external identity link. Never accept a Keycloak subject directly from the client.

Because Keycloak and PostgreSQL are separate systems, handle provisioning as a workflow with compensation: if local database creation fails after Keycloak creation, disable or remove the Keycloak user and record the failure. Prefer disabling users over hard deletion.

Add UUID primary keys, timestamps, unique constraints, foreign keys, deliberate delete behavior, and indexes for membership and authorization queries.

### Check

Create and apply the first migration. Query the tables through repositories and services, not directly from routes.

## Step 8: Keycloak in Compose

### Goal

Use a self-hosted identity provider instead of implementing password and session security in FastAPI.

Keycloak should run as a separate Compose service and use PostgreSQL storage. It may use a separate database on the same PostgreSQL server, but it must not share the application schema.

Add Keycloak settings to .env.example; never commit admin passwords.

### Check

- Keycloak starts after its database is ready.
- A development realm exists.
- An administrative client is configured.
- The Keycloak admin interface is not publicly exposed in production.

## Step 9: OpenID Connect Token Validation

### Goal

Validate platform-user access tokens issued by Keycloak.

FastAPI must validate the issuer, audience, signature, expiry, and allowed algorithm, then map the Keycloak subject (sub) to a local user.

FastAPI must not issue platform-user JWTs, store platform-user passwords, implement password reset, implement MFA, or trust unvalidated claims.

### Check

Test valid tokens, missing tokens, invalid signatures, expired tokens, wrong issuer, wrong audience, and unknown Keycloak subjects.

## Step 10: Permissions and Clinic Scoping

### Goal

Enforce authorization independently from authentication.

Initial permissions:

~~~text
clinic.read
user.manage
survey.create
survey.edit
survey.publish
campaign.create
campaign.send
response.view
analytics.view
export.create
audit.view
role.assign
~~~

Rules:

- Only administrators can assign roles.
- Every clinic-scoped query verifies membership.
- Never trust a client-provided clinic ID without checking access.
- Authorization is checked in the service layer.
- Super-administrator behavior is explicit and tested.

### Check

Verify that permitted users can access their clinic, unauthorized users receive 403, users cannot access another clinic, and only administrators can assign roles.

## Step 11: Audit Events

### Goal

Record who did what and when without storing sensitive data in logs.

Create an append-only audit_events table with actor, clinic, action, entity, timestamp, request ID, network metadata where appropriate, and non-sensitive structured metadata.

Audit authentication failures, permission changes, survey publishing, campaign changes, recipient imports, response access, exports, and archive actions.

Never log passwords, access tokens, full email content, or survey answers.

### Check

Trigger a protected action and verify that one audit event is created without sensitive values.

## Step 12: Redis and Worker Services

### Goal

Prepare infrastructure for email delivery, QR codes, and report exports.

Add Redis and a worker to the root Compose file. Do not implement campaign jobs yet.

Future worker jobs include email delivery, delivery retries, webhooks, QR generation, PDF generation, Excel generation, and cleanup. Every job must be idempotent and safe to retry.

### Check

- Redis starts through Compose.
- The worker starts without import errors.
- The worker can connect to Redis.
- Worker logs contain no secrets.

## Step 13: Automated Tests and Quality Checks

### Goal

Make the foundation safe to extend.

Test health endpoints, settings, database sessions, migration state, token validation, permission enforcement, cross-clinic rejection, and audit event creation.

Run:

~~~powershell
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy app
~~~

Do not merge new domain functionality while security tests are failing.

## Step 14: Phase 1 Final Check

Start implemented services from the repository root:

~~~powershell
cd C:\Users\OmarTrabulsi\umfrage_reintjes
docker compose config
docker compose up -d
docker compose ps
~~~

Verify:

- Migrations work against a clean database.
- /health and /ready behave correctly.
- Protected endpoints require Keycloak authentication.
- Clinic authorization prevents cross-clinic access.
- Audit events are created.
- Logs contain no passwords, tokens, or answer data.

Only add services that have been implemented and have working health checks.

## After Phase 1

Begin Phase 2 with the survey builder:

1. Survey and survey version models.
2. Sections and questions.
3. Question options and validation rules.
4. Draft editing.
5. Immutable publishing.
6. Survey CRUD authorization tests.
