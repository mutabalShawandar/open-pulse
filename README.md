# OpenPulse

> Open-source feedback infrastructure for teams and communities.

OpenPulse is a self-hostable, multi-tenant survey platform. Organizations can build reusable surveys, publish immutable versions, distribute campaigns through public links, collect anonymous responses, and review campaign analytics.

The interface and documentation are English-first. The product is deliberately industry-neutral: it is designed for teams, communities, agencies, events, and customer-feedback workflows.

## Planned feature set

- Organization-based multi-tenancy: each organization has many users and manages many client workspaces
- Organization-scoped roles, permissions, reusable survey catalogue, and workspace access boundaries
- Keycloak authentication with application-controlled user activation
- Reusable surveys with drafts and immutable published versions
- Sections, typed questions, options, validation, and ordering
- Campaigns tied to one exact published survey version
- Public anonymous survey links
- Secure response sessions, rate limiting, and typed answer persistence
- Campaign analytics and export workflows
- Docker Compose for local development and reference VPS deployment

## Scope

OpenPulse supports anonymous responses. Identified-response workflows are out of scope for the initial public edition.

### Organization model

An **Organization** is the tenant account. It has many member users and manages one or more **Workspaces**—for example, client accounts, teams, projects, or locations. Surveys belong to the organization’s reusable catalogue and can be assigned to its workspaces. A user can access only the organizations and workspaces where they hold membership and permission.

This repository is intended to be self-hosted, but it is not automatically production-ready. A real deployment needs a security review, encrypted backups, monitoring, retention/deletion policies, and load/security testing.

## Intended tech stack

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui
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
