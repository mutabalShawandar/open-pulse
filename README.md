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
- Keycloak authentication with application-controlled user activation, roles, and permissions
- English-first interface with German translation (`next-intl`, language switcher; PDF/Excel exports and default email templates are English only)
- Docker Compose for local development and a reference VPS deployment

## Scope of the first release (v0.1)

**v0.1 is a single-organization, self-hosted release.**

- The data model is organization-based: surveys belong to an organization's catalogue, workspaces belong to exactly one organization, and authorization is scoped to the organization and workspace. A single default organization is used, and platform administrators manage users, roles, and email (SMTP) settings.
- **Self-serve organization registration is disabled** (`ORGANIZATION_REGISTRATION_ENABLED=false`, the default). The `/register` page and the `POST /api/v1/organizations/register` endpoint return 404 unless you enable it. It is not supported in this release: a newly registered organization cannot yet manage its own users or email settings, so do not turn it on for real deployments.
- Per-organization subdomains (`app.{org-slug}.{root}`) are opt-in through `NEXT_PUBLIC_ROOT_DOMAIN` and are likewise not part of the supported v0.1 scope.
- Responses are anonymous only. Identified-response workflows are out of scope for the initial public edition.

### Roadmap: multi-organization support with Zitadel

Full multi-organization handling (self-serve sign-up, organization-scoped user and email administration, organization switcher, per-organization login) is planned for a later release and will be built on [Zitadel](https://zitadel.com), which supports organizations natively, instead of extending the Keycloak setup. Identity stays separate from authorization: whichever identity provider is used, membership, roles, and permissions remain in the application database, and a valid login alone never grants access. No migration work has started yet.

### Organization model

An **Organization** is the tenant account. It has member users and manages one or more **Workspaces**. Surveys belong to the organization's reusable catalogue and can be assigned only to workspaces of the same organization. A user can access only the organizations and workspaces where they hold membership and permission.

### Production readiness

This repository is intended to be self-hosted, but it is **not production-ready**. A real deployment needs a security review, encrypted backups, monitoring, retention/deletion policies, and load/security testing.

## Tech stack

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui, next-intl
- Backend: FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL
- Authentication: Keycloak
- Background jobs: Redis worker
- Object storage: S3-compatible storage
- Local email testing: Mailpit
- Deployment: Docker Compose

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

Database migrations run automatically (the `migrate` service), and a local platform
administrator is seeded automatically the first time the stack starts (the
`bootstrap-admin` service retries until Keycloak is ready).

When the stack is ready, open:

- Application: `http://localhost:3000`
- API documentation: `http://localhost:8000/docs`
- Keycloak: `http://localhost:8081`

Sign in at `http://localhost:3000` with the seeded local administrator:

- Email / username: `admin@openpulse.local` (Keycloak username `admin`)
- Password: `openpulse-dev-admin`

These credentials only work against your own local Keycloak instance — they are defined
directly in `docker/keycloak/local-realm/openpulse-realm.json`, which is committed for
local development only.
- Mailpit: `http://localhost:8025`

Stop the local stack:

```powershell
docker compose down
```

To delete local development data as well:

```powershell
docker compose down -v
```

## Development checks

```powershell
docker compose exec backend pytest
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
```

## VPS deployment

The production Compose configuration is a reference single-VPS setup. It requires Docker Engine, Docker Compose Plugin, HTTPS reverse proxying, a domain, and a server-local `.env.production` file containing real secrets.

```bash
git clone https://github.com/mutabalShawandar/open-pulse.git
cd open-pulse
cp .env.production.example .env.production
chmod 600 .env.production
```

Set all domains, database passwords, Keycloak secrets, storage credentials, and encryption keys in `.env.production`. Then run migrations and start the stack:

```bash
docker compose --project-name openpulse-prod --env-file .env.production -f docker-compose.prod.yml --profile migration run --rm migrate
docker compose --project-name openpulse-prod --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Do not expose PostgreSQL, Redis, or backend container ports publicly. Only your HTTPS reverse proxy should be publicly reachable.

## License

OpenPulse will be released under the [MIT License](LICENSE).
