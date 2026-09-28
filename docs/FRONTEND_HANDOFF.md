# Frontend Handoff

This document describes the backend capabilities available to the frontend after Phase 2.

## Recommended frontend

Use Next.js with TypeScript for the administration application. The same API contract also works with Vite + React.

Suggested initial stack:

- Next.js App Router
- TypeScript
- Tailwind CSS
- TanStack Query for server state
- Zod for client-side form validation
- React Hook Form for forms

The frontend should treat the backend as the source of truth for authentication, permissions, and clinic access.

## Local URLs

```text
Frontend:  http://localhost:3000
Backend:   http://localhost:8000
Swagger:   http://localhost:8000/docs
Keycloak:  http://localhost:8081
Mailpit:   http://localhost:8025
```

The backend API base URL should be configurable:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For Vite, use:

```env
VITE_API_URL=http://localhost:8000
```

## Authentication

The current development login endpoint is:

```text
POST /api/v1/auth/login
```

Request:

```json
{
  "username": "dev-admin",
  "password": "password"
}
```

Response:

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

Send the access token on authenticated requests:

```http
Authorization: Bearer <access_token>
```

The development login endpoint is disabled outside development mode. The production frontend should use Keycloak Authorization Code Flow with PKCE. Do not build password storage or JWT issuance into the frontend.

For local development, a short-lived token may be held in memory. If persistence is needed temporarily, use session storage and clear it on logout. Do not commit tokens or credentials to the repository.

## Current API

### Health

```text
GET /health
GET /ready
```

`/health` confirms that the process is running. `/ready` also checks PostgreSQL connectivity.

### Current user

```text
GET /api/v1/me
```

Response:

```json
{
  "id": "user-uuid",
  "email": "admin@example.com",
  "display_name": "Development Admin",
  "is_active": true
}
```

Use this response to render the signed-in user and decide which global navigation items to show. The backend remains authoritative; hidden UI controls are not a security boundary.

### Create a platform user

```text
POST /api/v1/users
```

Requires the global `user.manage` permission.

Request:

```json
{
  "email": "staff@example.com",
  "display_name": "Staff Member"
}
```

The backend creates the user in Keycloak, creates the local identity link, and asks Keycloak to send account setup instructions.

### Create a clinic

```text
POST /api/v1/clinics
```

Requires the global `clinic.create` permission.

Request:

```json
{
  "name": "Example Workspace",
  "slug": "example-workspace",
  "logo_url": null,
  "street": "Hauptstraße",
  "hausnummer": 10,
  "city": "Berlin",
  "postal_code": "10115"
}
```

The `slug` must be unique.

### Read a clinic

```text
GET /api/v1/clinics/{clinic_id}
```

Requires `clinic.read` through a role assigned to that clinic. A platform administrator can be granted global access once the global-admin bypass is enabled in the authorization policy.

### Assign a user to a clinic

```text
POST /api/v1/clinics/{clinic_id}/members
```

Requires the global `role.assign` permission.

Request:

```json
{
  "user_id": "user-uuid",
  "role_id": "role-uuid"
}
```

The target user must exist and be active. The target role must exist. Duplicate assignments return `409`.

## Phase 2: Agency Survey Catalogue

Surveys are reusable agency catalogue records, not clinic-owned records. A survey can have multiple editable drafts and immutable published versions. A published version is explicitly assigned to one or more clinics before a future campaign may use it.

The frontend should treat these objects separately:

```text
Survey (agency catalogue record)
  -> Draft version(s) (editable)
  -> Published version(s) (immutable)
  -> Clinic assignment(s) (which clinic may use which published version)
```

### Survey catalogue

| Endpoint | Permission | Purpose |
| --- | --- | --- |
| `GET /api/v1/surveys` | `survey.read` | List active catalogue surveys. |
| `POST /api/v1/surveys` | `survey.create` | Create a survey and its first empty draft. |
| `GET /api/v1/surveys/{survey_id}` | `survey.read` | Read metadata and draft summaries. |
| `PATCH /api/v1/surveys/{survey_id}` | `survey.edit` | Update catalogue title/description. |
| `POST /api/v1/surveys/{survey_id}/archive` | `survey.edit` | Archive a survey. |
| `POST /api/v1/surveys/{survey_id}/restore` | `survey.edit` | Restore an archived survey. |

Create request:

```json
{
  "title": "Patientenzufriedenheit 2026",
  "description": "Standardfragebogen der Agentur",
  "initial_draft_label": "Erster Entwurf"
}
```

An archive removes the survey from the normal catalogue list. It does not delete historical versions or clinic assignments.

### Draft survey builder

All builder mutations require `survey.edit`. A published version cannot be edited; the API returns `409`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/surveys/{survey_id}/drafts/{draft_id}` | Read a complete draft: sections, questions, options, and validation rules. |
| `POST /api/v1/surveys/{survey_id}/drafts` | Create an empty draft or copy a source version into a draft. |
| `POST /api/v1/surveys/{survey_id}/drafts/{draft_id}/sections` | Add a section. |
| `PATCH` / `DELETE /.../sections/{section_id}` | Edit or remove a section. |
| `POST /.../sections/reorder` | Replace the section order with a complete ID list. |
| `POST /.../sections/{section_id}/questions` | Add a question. |
| `PATCH` / `DELETE /.../questions/{question_id}` | Edit or remove a question. |
| `POST /.../questions/reorder` | Replace question order within the section. |
| `POST /.../questions/{question_id}/options` | Add a choice option. |
| `PATCH` / `DELETE /.../options/{option_id}` | Edit or remove an option. |
| `POST /.../options/reorder` | Replace option order. |
| `GET` / `POST /.../questions/{question_id}/validations` | List or add validation rules. |
| `PATCH` / `DELETE /.../validations/{validation_id}` | Edit or remove a validation rule. |

Use the full ordered sibling ID list for each reorder request:

```json
{
  "section_ids": ["first-section-uuid", "second-section-uuid"]
}
```

Question create request:

```json
{
  "question_type": "single_choice",
  "title": "Würden Sie uns weiterempfehlen?",
  "help_text": null,
  "is_required": true
}
```

Supported question types are `single_choice`, `multiple_choice`, `yes_no`, `rating`, `short_text`, `long_text`, `number`, and `date`.

Options are permitted only on `single_choice` and `multiple_choice` questions. Validation requests use a single `value` property, for example:

```json
{
  "rule_type": "min_value",
  "rule_value": { "value": 1 }
}
```

Use the following rules in the frontend form builder:

| Question type | Supported validation rules |
| --- | --- |
| `rating` | `min_value`, `max_value`, `step` |
| `short_text`, `long_text` | `min_length`, `max_length` |
| `number` | `min_value`, `max_value` |
| `date` | `min_date`, `max_date` (ISO date) |
| `multiple_choice` | `min_selections`, `max_selections` |

### Copy and publish

Create a new draft from any draft or published version:

```text
POST /api/v1/surveys/{survey_id}/drafts
```

```json
{
  "draft_label": "Variante für Klinik Nord",
  "source_version_id": "source-version-uuid"
}
```

Copy a selected version into a fully independent agency survey:

```text
POST /api/v1/surveys/{survey_id}/copy
```

```json
{
  "source_version_id": "source-version-uuid",
  "title": "Patientenzufriedenheit Kinderarztpraxis"
}
```

Publish a valid draft with `survey.publish`:

```text
POST /api/v1/surveys/{survey_id}/drafts/{draft_id}/publish
```

Publishing freezes the draft, assigns the next version number, and rejects further mutations. To change published content, create a new draft from that version first.

Read published versions with `survey.read`:

```text
GET /api/v1/surveys/{survey_id}/versions
GET /api/v1/surveys/{survey_id}/versions/{version_number}
```

The detail endpoint returns the immutable questionnaire hierarchy and is the object future campaign screens should select.

### Clinic version assignments

| Endpoint | Permission | Purpose |
| --- | --- | --- |
| `GET /api/v1/clinics/{clinic_id}/survey-versions` | `clinic.read` for that clinic | List active assigned versions. |
| `POST /api/v1/clinics/{clinic_id}/survey-versions/{version_id}/assign` | `survey.assign` plus `clinic.read` | Assign a published version. |
| `POST /api/v1/clinics/{clinic_id}/survey-versions/{version_id}/unassign` | `survey.assign` plus `clinic.read` | Soft-unassign a version. |

The assignment UI should only offer published versions. Assigning an already assigned version is safe; unassigning an already unassigned version is also safe.

## Roles and permissions

Global roles:

| Role | Purpose |
| --- | --- |
| `platform_admin` | Platform-wide administration |
| `clinic_manager` | Manage assigned clinic surveys and campaigns |
| `clinic_viewer` | View assigned clinic data and analytics |

Important permissions:

| Permission | Scope |
| --- | --- |
| `user.manage` | Global |
| `clinic.create` | Global |
| `role.assign` | Global |
| `clinic.read` | Clinic-specific |
| `survey.read` | Global agency catalogue |
| `survey.create` | Global agency catalogue |
| `survey.edit` | Global agency catalogue |
| `survey.publish` | Global agency catalogue |
| `survey.assign` | Global, plus target-clinic membership |
| `campaign.create` | Clinic-specific |
| `campaign.send` | Clinic-specific |
| `response.view` | Clinic-specific |
| `analytics.view` | Clinic-specific |
| `export.create` | Clinic-specific |

The frontend may use permissions to improve navigation and button visibility, but every operation must still be authorized by the backend.

## Error handling

Handle these statuses consistently:

| Status | Meaning | Frontend behavior |
| --- | --- | --- |
| `401` | Missing, expired, or invalid token | Clear auth state and redirect to login |
| `403` | Authenticated but not authorized | Show an access-denied message |
| `404` | Resource does not exist or active user/role was not found | Show a not-found state |
| `409` | Duplicate slug or membership | Show a field or conflict error |
| `422` | Request validation failed | Display form validation errors |
| `503` | Backend, database, or Keycloak unavailable | Show retryable service error |

Do not display raw exception traces to users.

## Suggested initial pages

Build these pages first:

```text
/login
/dashboard
/clinics/new
/clinics/[clinicId]
/clinics/[clinicId]/members/new
/users/new
/surveys
/surveys/new
/surveys/[surveyId]
/surveys/[surveyId]/drafts/[draftId]
/clinics/[clinicId]/survey-versions
/system-status
```

Suggested dashboard navigation:

```text
Dashboard
Clinics
Surveys
Users
System status
```

The clinic detail page can show clinic metadata and a membership-assignment form. A clinic list endpoint does not exist yet, so the first UI can use a known clinic ID or wait for the next backend endpoint.

## API client behavior

Create one shared API client that:

1. Prefixes requests with the configured API URL.
2. Adds the bearer token to authenticated requests.
3. Parses JSON errors consistently.
4. Handles `401` centrally.
5. Invalidates cached user and clinic data after mutations.

Do not hardcode UUIDs, role IDs, or backend URLs in components.

## Not available yet

The following features belong to later backend phases and should not be implemented as final frontend flows yet:

- Campaign creation and branding.
- Public survey links.
- Response collection.
- Recipient imports and email delivery.
- Analytics dashboards.
- Excel and PDF exports.

The frontend can use placeholder navigation for these areas, but it should not invent API contracts for them.

## Local startup

Start the backend services from the repository root:

```powershell
docker compose up -d
```

Start the frontend using the chosen framework. For Next.js, the expected command will be:

```powershell
npm run dev
```

Confirm the backend is ready before using the frontend:

```text
http://localhost:8000/ready
```
