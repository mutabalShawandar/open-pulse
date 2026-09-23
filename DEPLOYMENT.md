# Deployment configuration

`docker-compose.yml` remains the local development stack. It is intentionally
not used on the VPS.

`docker-compose.prod.yml` is a production-like stack. Use it for both staging
and production with distinct Compose project names and distinct environment
files. Docker scopes named volumes by project name, so no local database or
storage volume is copied to the VPS.

## Fresh staging deployment

1. Copy `.env.production.example` to a VPS-only `.env.staging`, set staging
   URLs, credentials and unique localhost ports, and set
   `DEPLOY_ENV_FILE=.env.staging`.
2. Set `KEYCLOAK_REALM_IMPORT_DIR=realm-staging`. The committed
   `docker/keycloak/realm-staging/Umfrage-staging-realm.json` is imported only
   into the fresh staging Keycloak database. Do not point staging at `realm`,
   which is the production `Umfrage` realm.
3. Create infrastructure services, then run the migration job once. Start the
   application services only after that job succeeds:

   ```bash
   docker compose --project-name umfrage-staging --env-file .env.staging -f docker-compose.prod.yml up -d --build postgres redis storage keycloak
   docker compose --project-name umfrage-staging --env-file .env.staging -f docker-compose.prod.yml --profile migration run --rm migrate
   docker compose --project-name umfrage-staging --env-file .env.staging -f docker-compose.prod.yml up -d --build backend worker frontend
   ```

4. Create the first user in Keycloak and bootstrap its application role:

   ```bash
   docker compose --project-name umfrage-staging --env-file .env.staging -f docker-compose.prod.yml exec backend python scripts/bootstrap_platform_admin.py --email you@example.de
   ```

5. Replace the temporary Keycloak bootstrap administrator before allowing any
   normal use. In the `master` realm, create a permanent operations user,
   assign its `realm-management` client role `realm-admin`, set a non-temporary
   password, and require a second factor. Verify this account in a separate
   browser session. Only then delete the temporary bootstrap user and remove
   `KC_BOOTSTRAP_ADMIN_USERNAME` and `KC_BOOTSTRAP_ADMIN_PASSWORD` from the
   VPS-only environment file.

   This Keycloak operations administrator is separate from the first Umfrage
   platform administrator above. The platform administrator belongs in the
   `Umfrage` realm and gets application permissions from the application
   database; it must not receive Keycloak server administration privileges.

For production, repeat the same process using the project name `umfrage-prod`,
`.env.production`, and `KEYCLOAK_REALM_IMPORT_DIR=realm`. Never copy a local
Docker volume, local database dump, or staging volume into production.

## Nginx

Nginx remains the only public entry point. It proxies the three localhost
ports from the environment file to `app`, `api`, and `auth` subdomains. Do not
publish PostgreSQL, Redis, SeaweedFS, or worker ports.

## Migrations

Migrations are an explicit one-shot job. CI/CD must run the `migrate` command
and stop the release when it fails; API and worker containers must never run
Alembic automatically on their own startup.
