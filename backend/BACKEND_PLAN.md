# Backend Plan

## 1. Recommended Architecture

Build the first version as a Python modular monolith. One deployable backend is simpler to operate on a single VPS, while clear domain modules keep the code ready for future extraction if growth requires it.

Recommended stack:

- Python 3.12+
- `uv` for Python dependency and environment management
- FastAPI for the HTTP API
- Keycloak for self-hosted user identity, login, sessions, password flows, and optional MFA
- PostgreSQL for durable application data
- SQLAlchemy 2 for database access
- Alembic for migrations
- Pydantic for request and response schemas
- Redis for short-lived state, rate limiting, and task support
- Celery or Dramatiq for email delivery and report generation
- SMTP provider or self-hosted-compatible mail relay for email campaigns
- S3-compatible storage such as MinIO for logos and generated exports
- Root-level Docker Compose for local development and the initial VPS deployment

Do not split into microservices initially. The application has strong transactional relationships between surveys, campaigns, recipients, responses, and permissions.

## 2. Core Domain Model

### Identity and Access

- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `clinic_members`
- `external_identity_links` for mapping Keycloak subjects to local users
- `audit_events`

### Clinics

- `clinics`
- `clinic_settings`
- `clinic_assets`

Clinics are tenant records and do not log in. Only human platform users authenticate through Keycloak. A platform user may manage many clinics, and a clinic may be managed by many platform users through `clinic_members`. Patients and email recipients also do not need platform accounts; they use public or campaign-specific response links.

### Survey Builder

- `surveys`
- `survey_versions`
- `survey_sections`
- `survey_questions`
- `survey_question_options`
- `survey_question_validations`

Useful initial question types:

- Single choice
- Multiple choice
- Yes/no
- Rating or scale
- Short text
- Long text
- Number
- Date

Store the question type explicitly and keep answer validation type-specific. Avoid storing every answer as untyped text.

### Campaigns and Distribution

- `campaigns`
- `campaign_assets`
- `campaign_email_templates`
- `campaign_recipients`
- `campaign_deliveries`
- `campaign_access_tokens`
- `campaign_events`

Model public access as a campaign distribution mode internally. This allows both public links and email campaigns to use the same response pipeline and analytics while retaining separate UI terminology.

### Responses

- `responses`
- `response_answers`
- `response_answer_options`
- `response_events`

For typed reporting, use either typed answer columns such as `text_value`, `number_value`, `date_value`, and `boolean_value`, or a carefully validated JSON value plus normalized option rows. A hybrid model is usually the most practical for this product.

Important fields include:

- Survey version ID
- Campaign ID
- Recipient ID, nullable
- Anonymous flag or identity mode snapshot
- Started and completed timestamps
- Completion state
- Secure response/session identifier

When campaign anonymization is active, do not store the recipient relationship on the response, or store it in a separately protected participation record that cannot be joined by normal reporting queries. The safest first implementation is to omit the relationship from the answer record entirely.

### Exports

- `export_jobs`
- `export_files`

Exports should be asynchronous. Store status, requested format, filters, requesting user, expiry time, and a link to private storage.

## 3. Survey Lifecycle

Use an explicit lifecycle:

```text
draft -> published -> archived
```

Recommended rules:

- Draft surveys can be edited.
- A published version is immutable.
- Publishing creates a version snapshot.
- A new edit creates a new draft version.
- Existing campaigns remain connected to their selected published version.
- A survey cannot be deleted if it has historical responses; archive it instead.

This prevents analytics and exports from changing when a question is edited later.

## 4. Campaign Lifecycle

```text
draft -> scheduled -> active -> paused -> completed
                         \-> cancelled
```

The exact states can be simplified initially, but delivery status and campaign status should be separate. A campaign can be active while individual emails are pending or failed.

Each campaign should snapshot its presentation settings:

- Title
- Description
- Logo
- Colors
- Background
- Email subject and body
- Sender display name
- Start and end dates
- Anonymization setting

## 5. API Structure

Use versioned REST endpoints initially:

```text
/api/v1/auth
/api/v1/users
/api/v1/clinics
/api/v1/roles
/api/v1/surveys
/api/v1/surveys/{survey_id}/versions
/api/v1/campaigns
/api/v1/campaigns/{campaign_id}/recipients
/api/v1/campaigns/{campaign_id}/send
/api/v1/campaigns/{campaign_id}/analytics
/api/v1/campaigns/{campaign_id}/exports
/api/v1/public/campaigns/{slug}
/api/v1/public/responses
```

Keep public response endpoints separate from authenticated administration endpoints. Public endpoints need strict rate limiting, payload limits, anti-abuse controls, and no accidental exposure of recipient or administrative data.

## 6. Authentication and Authorization

FastAPI is the API framework, not the application's identity provider. Do not implement password storage, password reset, login sessions, MFA, or JWT issuance in the backend.

Use self-hosted Keycloak as the identity provider:

- Keycloak manages users, passwords, sessions, email verification, password reset, and optional MFA.
- Next.js uses OpenID Connect Authorization Code Flow with PKCE for platform-user login, including administrators and staff users.
- FastAPI validates Keycloak access tokens using the configured issuer, audience, signature, expiry, and intended algorithm.
- The backend maps the validated Keycloak subject to a local user record.
- Local database tables control clinic membership, application roles, and abstract permissions.

Administrators manage platform users, clinics, roles, and user-to-clinic assignments. Clinic assignment is application data and is not managed by clinic accounts in Keycloak because clinics do not authenticate.

Do not auto-provision arbitrary users merely because they have a valid Keycloak login. Application access must be granted through an administrator-controlled provisioning workflow.

User provisioning must use Keycloak's Admin REST API or administrative CLI (`kcadm`), never a manually invented external subject. The backend creates the local `users` and `external_identity_links` records only after Keycloak successfully returns the new user's subject. The client must never submit a subject to be trusted.

Keycloak and PostgreSQL are separate systems, so provisioning is not one atomic transaction. Use a service workflow with compensation and reconciliation: if the local transaction fails after Keycloak creation, disable or remove the Keycloak user and record the failure for review. A later outbox or reconciliation job can make this more robust.

Prefer deactivation over hard deletion for platform users. Disable the Keycloak user and mark the local user inactive. Hard deletion must be an explicit administrative operation with a retention review.

FastAPI security dependencies should only extract and validate the authenticated principal. Authorization belongs in the service layer, not only in route handlers. Use permission names such as `survey.publish` and `campaign.export`, and always scope queries by the user's clinic memberships.

Keycloak, PostgreSQL, Redis, the worker, and the backend should communicate over the private Docker network. Keycloak's administration interface must not be exposed publicly without explicit protection.

The first authentication milestone must test valid tokens, expired tokens, wrong issuer, wrong audience, invalid signatures, missing permissions, and cross-clinic access. FastAPI's built-in security helpers are useful for integration, but they do not replace an identity provider or an authorization model.

## 7. Background Jobs

Use a worker process for:

- Sending campaign emails
- Retrying transient email failures
- Processing delivery webhooks
- Generating QR codes
- Generating PDF reports
- Generating Excel workbooks
- Cleaning expired tokens and temporary files
- Sending administrative notifications

Every job should be idempotent. A retry must not send the same email twice or create duplicate exports.

## 8. Analytics Design

Keep raw response data and computed analytics separate.

The analytics service should calculate:

- Counts and percentages for choice questions
- Average, median, minimum, maximum, and distribution for rating/scale questions
- Completion and abandonment rates
- Response trends by date
- Per-question response counts
- Text answer lists with permission-aware filtering

Begin with SQL queries and indexed tables. Add precomputed aggregates only if real campaign sizes make live queries too slow.

Analytics must apply anonymity rules before aggregation or row-level output. Small-group reporting may need suppression rules to reduce re-identification risk; this should be configurable after the privacy requirements are confirmed.

## 9. Export Design

Excel export:

- One sheet for campaign metadata
- One sheet for recipients and delivery status, only when permitted
- One sheet for normalized answers
- One sheet for question summaries
- German column names and date formatting

PDF export:

- Campaign title and clinic branding
- Date range and participation summary
- Charts for choice and rating questions
- Tables or appendix for text answers, subject to permissions and privacy settings

Recommended Python libraries are `openpyxl` or `xlsxwriter` for Excel and an HTML-to-PDF renderer such as WeasyPrint for PDF. Generate files in a worker and store them privately with an expiry date.

## 10. Audit Logging

Create an append-only `audit_events` table containing:

- Actor user ID, nullable for system actions
- Clinic ID
- Action name
- Entity type and entity ID
- Timestamp
- Request ID
- IP address and user agent where appropriate
- Structured metadata without sensitive answer content

Audit events should cover login/security events, permission changes, survey publishing, campaign changes, recipient imports, email sends, response access, exports, and deletion/archive actions.

Never place survey answers, passwords, access tokens, or full email content in audit metadata.

## 11. Security and Privacy Baseline

- Let Keycloak manage password hashing and account security; never store application passwords.
- Validate access tokens against Keycloak's issuer, audience, signature, expiry, and allowed algorithms.
- Store only hashed campaign and response tokens.
- Use HTTPS everywhere in production.
- Use secure, HTTP-only, SameSite cookies.
- Apply rate limits to public survey endpoints and authentication-related application endpoints.
- Validate uploaded files and restrict size and MIME type.
- Encrypt backups and restrict database access to the private Docker network.
- Keep secrets in environment variables or a VPS secret manager, never in Git.
- Add retention and deletion policies for recipients, responses, exports, and audit records.
- Ensure logs do not contain personal answers or tokens.
- Document the data-processing and access model before production deployment.

## 12. Folder Structure

```text
backend/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── deps.py
│   │   └── v1/
│   │       ├── router.py
│   │       ├── auth.py
│   │       ├── users.py
│   │       ├── clinics.py
│   │       ├── roles.py
│   │       ├── surveys.py
│   │       ├── survey_versions.py
│   │       ├── campaigns.py
│   │       ├── recipients.py
│   │       ├── responses.py
│   │       ├── analytics.py
│   │       ├── exports.py
│   │       └── public.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── permissions.py
│   │   ├── logging.py
│   │   └── exceptions.py
│   ├── db/
│   │   ├── session.py
│   │   ├── base.py
│   │   └── migrations/
│   ├── models/
│   │   ├── identity.py
│   │   ├── clinic.py
│   │   ├── survey.py
│   │   ├── campaign.py
│   │   ├── response.py
│   │   ├── audit.py
│   │   └── export.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── clinic.py
│   │   ├── survey.py
│   │   ├── campaign.py
│   │   ├── response.py
│   │   ├── analytics.py
│   │   └── export.py
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── survey_service.py
│   │   ├── campaign_service.py
│   │   ├── recipient_service.py
│   │   ├── response_service.py
│   │   ├── analytics_service.py
│   │   ├── export_service.py
│   │   ├── audit_service.py
│   │   └── storage_service.py
│   ├── repositories/
│   │   ├── survey_repository.py
│   │   ├── campaign_repository.py
│   │   ├── response_repository.py
│   │   └── user_repository.py
│   ├── workers/
│   │   ├── celery_app.py
│   │   ├── email_tasks.py
│   │   ├── export_tasks.py
│   │   └── cleanup_tasks.py
│   └── integrations/
│       ├── email/
│       ├── pdf/
│       ├── spreadsheet/
│       └── qr_codes/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── api/
│   └── security/
├── alembic.ini
├── pyproject.toml
├── Dockerfile
└── .env.example
```

The repository-level deployment structure is:

```text
/
├── backend/
├── frontend/
├── docker-compose.yml
├── deploy/
│   ├── Caddyfile
│   ├── backup.sh
│   └── systemd/
└── README.md
```

The root `docker-compose.yml` is the deployment entry point. It should orchestrate the frontend, backend, PostgreSQL, Keycloak, Redis, worker, reverse proxy, and any storage service used by the project. Production should be started from the repository root with one Compose deployment, with secrets supplied through protected environment files or a secret manager.

## 13. Delivery Phases

### Phase 1: Foundation

- FastAPI application and health checks
- `uv` project configuration and locked dependencies
- PostgreSQL and migrations
- Configuration and structured logging
- Root-level Docker Compose with backend, PostgreSQL, Keycloak, Redis, and worker services
- Keycloak realm and client configuration
- FastAPI token validation
- Local users, clinics, roles, permissions, and clinic-scoped authorization
- Audit event infrastructure
- Security tests for token validation and authorization boundaries

### Phase 2: Survey Builder

- Survey, section, question, and option models
- Draft editing
- Validation rules
- Publish and immutable version snapshots
- Basic CRUD API tests

### Phase 3: Campaigns and Public Responses

- Campaign branding
- Public campaign links
- Public response session
- Anonymous response handling
- Response validation and completion
- Rate limiting and abuse protection

### Phase 4: Email Distribution

- Recipient import and manual entry
- Secure token generation and hashing
- Email templates
- Worker-based sending and retries
- Delivery/open/click tracking where legally and technically appropriate
- Participation status
- Campaign anonymization mode

### Phase 5: Analytics and Exports

- Campaign overview metrics
- Question-level analytics
- Text answer tables
- Excel export
- PDF report generation
- Export permissions and audit events

### Phase 6: Production Hardening

- Automated encrypted backups
- Monitoring and error reporting
- Retention and deletion jobs
- Security testing
- Load testing public response endpoints
- VPS deployment documentation and recovery procedure

## 14. First Implementation Order

Start with the smallest end-to-end slice:

1. Create the `uv`-managed FastAPI project.
2. Start the root Docker Compose stack with PostgreSQL and Keycloak.
3. Configure one development Keycloak realm and client.
4. Validate Keycloak tokens in FastAPI.
5. Create a clinic, local user mapping, and an admin permission.
6. Protect one endpoint with `survey.create`.
7. Test invalid tokens, missing permissions, and cross-clinic access.
8. Create a survey with one section and several core question types.
9. Publish an immutable survey version.
10. Create a public campaign with custom branding.
11. Submit an anonymous response through the public API.
12. Display response counts and question summaries.
13. Add an Excel export.

Once this path works, add email campaigns, identified responses, PDF reports, and the remaining administration features. This keeps the most important product workflow testable from the beginning.
