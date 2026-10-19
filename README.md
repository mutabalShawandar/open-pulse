# OpenPulse

> Open-source feedback infrastructure for teams and communities.

OpenPulse is a self-hostable, multi-tenant survey platform. Organizations can build reusable surveys, publish immutable versions, distribute campaigns through public links, collect anonymous responses, and review campaign analytics.

The interface and documentation are English-first, with a German translation available from the language switcher. The product is deliberately industry-neutral: it is designed for teams, communities, agencies, events, and customer-feedback workflows.

## Features

- Reusable surveys with multiple drafts and immutable published versions
- Sections, typed questions, choice options, validation rules, and ordering
- Workspaces (client accounts, teams, projects, or locations) that surveys are assigned to
- Campaigns tied to one exact published survey version, with per-campaign branding
- Public anonymous survey links with secure response sessions, rate limiting, and typed answer persistence
- Recipient import and email campaigns with SMTP configuration, templates, and retry/delivery-status tracking
- Campaign analytics with PDF and Excel export
- Keycloak authentication with application-controlled user activation, roles, and permissions (to be replaced by Zitadel, see the roadmap)
- English-first interface with German translation (`next-intl`, language switcher; PDF/Excel exports and default email templates are English only)
- One-command Docker Compose setup for local use: Keycloak, Mailpit for test emails, a seeded administrator, and optional demo data

## Scope of the first release (v0.1)

**v0.1 is a single-organization, self-hosted release for local use.**

- The data model is organization-based: surveys belong to an organization's catalogue, workspaces belong to exactly one organization, and authorization is scoped to the organization and workspace. v0.1 runs with one default organization, and platform administrators manage users, roles, and email (SMTP) settings.
- Sign-in uses [Keycloak](https://www.keycloak.org) purely as an identity provider. Roles, permissions, and workspace membership live in the application database, and a valid login alone never grants access. See the roadmap below: this identity setup is temporary.
- **Self-serve organization registration is disabled** (`ORGANIZATION_REGISTRATION_ENABLED=false`, the default). The `/register` page and the `POST /api/v1/organizations/register` endpoint return 404 unless you enable it. It is not supported in this release: a newly registered organization cannot yet manage its own users or email settings, so do not turn it on for real deployments.
- Per-organization subdomains (`app.{org-slug}.{root}`) are opt-in through `NEXT_PUBLIC_ROOT_DOMAIN` and are likewise not part of the supported v0.1 scope.
- Responses are anonymous only. Identified-response workflows are out of scope for the initial public edition.

### Roadmap: identity, organizations, and authentication with Zitadel

The plan is to move identity, organizations, and authentication to [Zitadel](https://zitadel.com), which supports organizations natively. That covers self-serve sign-up, organization-scoped users and administration, an organization switcher, and per-organization login.

This is a **large refactoring step, not a configuration change**. It replaces the Keycloak integration (token validation, the Keycloak admin client, user provisioning and activation, the login and logout flows, and the local realm), and it reshapes how organizations and memberships are modeled and registered. No migration work has started, and the design has not been written yet.

What this means for v0.1 and for contributors:

- The current Organization model, the registration endpoint, the per-organization subdomain handling, and everything that talks to Keycloak are **transitional** and are expected to change.
- Please open an issue to discuss a change before building on those parts, especially anything that deepens the dependency on Keycloak or on the current organization model.
- One rule is expected to survive the migration: a valid login by itself must never grant access to the application.

### Organization model (current)

An **Organization** is the tenant account. It has member users and manages one or more **Workspaces**. Surveys belong to the organization's reusable catalogue and can be assigned only to workspaces of the same organization. A user can access only the organizations and workspaces where they hold membership and permission. This model is expected to be reshaped by the Zitadel migration described above.

### Deployment scope

v0.1 targets **local, self-hosted use on localhost** with Docker Compose. There is no supported production deployment and no production Compose file yet, and the project is **not production-ready**: it still needs a security review, encrypted backups, monitoring, retention and deletion policies, and load and security testing. See [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md).

## Tech stack

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui, next-intl
- Backend: FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL
- Authentication: Keycloak (planned to move to Zitadel)
- Background jobs: Redis worker
- Object storage: S3-compatible storage
- Local email testing: Mailpit
- Local runtime: Docker Compose

## Local setup

### Requirements

- Docker Desktop with Docker Compose
- Git

### Start the application

```powershell
git clone https://github.com/mutabalShawandar/open-pulse.git
cd open-pulse

Copy-Item .env.example .env
```

`.env.example` already contains working local-development values — nothing needs to be
changed to start the stack. Never commit the copied `.env` file, and never reuse these
values for a real deployment.

```powershell
docker compose up --build -d
```

Database migrations run automatically (the `migrate` service). On first start the
`bootstrap-admin` service also seeds a local platform administrator and a default
outbound SMTP configuration that points at the bundled Mailpit inbox. It retries until
Keycloak is ready, which takes about a minute. The database starts otherwise empty.

To also load demo data (a workspace, a published survey, a campaign with responses for
analytics, and an unsent campaign with three recipients), start with the `demo` profile:

```powershell
docker compose --profile demo up --build -d
```

Open the "Invitation demo" campaign and send it; the emails appear in Mailpit.

When the stack is ready, open:

- Application: `http://localhost:3000`
- API documentation: `http://localhost:8000/docs`
- Keycloak: `http://localhost:8081`
- Mailpit (captured emails): `http://localhost:8025`

Sign in at `http://localhost:3000` with the seeded local administrator:

- Email / username: `admin@openpulse.local` (Keycloak username `admin`)
- Password: `openpulse-dev-admin`

These credentials only work against your own local Keycloak instance — they are defined
directly in `docker/keycloak/local-realm/openpulse-realm.json`, which is committed for
local development only.

Stop the local stack:

```powershell
docker compose down
```

To delete local development data as well:

```powershell
docker compose down -v
```

## Development and tests

Backend (Python 3.14 and [uv](https://docs.astral.sh/uv/)):

```powershell
cd backend
uv sync --locked --all-groups
uv run ruff check .
uv run ruff format --check .
uv run pytest tests --ignore=tests/integration   # unit tests, no services needed
```

The integration tests need a migrated PostgreSQL database, and the delivery test also needs Mailpit. Start both throwaway containers, then run the full suite:

```powershell
docker run -d --rm --name openpulse-test-db -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 55432:5432 postgres:16-alpine
docker run -d --rm --name openpulse-test-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit:v1.27.4

$env:APP_ENV = "test"
$env:DATABASE_URL = "postgresql+asyncpg://test:test@localhost:55432/test"
$env:TEST_DATABASE_URL = $env:DATABASE_URL
$env:MAILPIT_API_URL = "http://localhost:8025"
$env:KEYCLOAK_URL = "http://localhost:8081"
$env:KEYCLOAK_INTERNAL_URL = "http://localhost:8081"
$env:KEYCLOAK_REALM = "openpulse"
$env:KEYCLOAK_CLIENT_ID = "openpulse-frontend"
$env:KEYCLOAK_AUDIENCE = "openpulse-api"
$env:KEYCLOAK_ISSUER = "http://localhost:8081/realms/openpulse"

uv run alembic upgrade head
uv run pytest tests
```

Frontend (Node.js 24):

```powershell
cd frontend
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

GitHub Actions runs all of the above on every pull request, plus a Compose smoke test (`.github/scripts/compose-smoke.sh`), CodeQL, and Snyk. Frontend tests (Vitest) check translation key parity, auth redirects, the API client, and the administration pages.

## License

OpenPulse is released under the [MIT License](LICENSE).
