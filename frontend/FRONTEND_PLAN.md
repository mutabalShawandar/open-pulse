# Frontend Plan

## Purpose and current scope

This directory contains the Next.js administration frontend for the German multi-clinic survey platform. It consumes the FastAPI backend in `../backend`.

The backend phases currently available are:

- **Phase 1:** Keycloak-backed platform-user authentication, local access control, clinics, roles, permissions, clinic membership, and audit events.
- **Phase 2:** Agency-wide survey catalogue, editable drafts, typed questions, validation, immutable published versions, and published-version assignment to clinics.

Build an authenticated internal administration application first. Do **not** build campaign, patient, public-survey, response, analytics, export, or email-distribution functionality until their backend phases exist.

## Baseline

- Next.js `16.3.5`, App Router, TypeScript, React 19, Tailwind CSS 4.
- shadcn/ui is initialised using `base-nova`, Base UI primitives, `lucide-react`, and `@/*` imports.
- `components/ui/` contains locally owned shadcn source components. Reuse them rather than creating substitute primitives.
- The UI language is German. Use clear, professional German product copy and German date formatting.

Before modifying Next.js code, read the relevant versioned documentation under `node_modules/next/dist/docs/`, as required by `AGENTS.md`.

## Architecture decisions

### Current access policy

- All active platform users may access all clinics. Do not gate clinic visibility or clinic workflows on `clinic_members` in the frontend.
- `platform_admin` is reserved for platform-user lifecycle operations, including provisioning, permanent deletion, reactivation, and administrator promotion/demotion.
- This supersedes the earlier frontend assumption that ordinary users receive clinic-scoped roles. The backend authorization checks must be aligned before clinic workflows are exposed.

### Authentication

- Keycloak remains the identity provider. Never implement passwords, reset flows, MFA, or token issuance in Next.js.
- Use OIDC Authorization Code Flow with PKCE for platform-user login.
- Prefer a server-side token/session design with secure, HTTP-only cookies. Do not store access tokens in `localStorage` or expose Keycloak administration credentials to the browser.
- After authentication, call `GET /api/v1/me`. A valid Keycloak login without a local active user record is not application access; show a dedicated access-denied/provisioning screen.
- FastAPI is authoritative for authorization. UI permission checks only improve usability and must not be relied on for security.

### API boundary

- Keep `NEXT_PUBLIC_API_BASE_URL` for the FastAPI base URL.
- Centralise API calls and error handling in `lib/api/`; do not scatter raw `fetch()` calls through page components.
- Send the Keycloak access token only server-side where feasible, through a small Next.js route-handler/BFF layer.
- Handle `401` by ending/refreshing the browser session, `403` with an access-denied state, `404` with `not-found.tsx`, and FastAPI validation errors as field or form errors.

### Rendering and state

- Use Server Components by default. Mark only interactive components (`forms`, dialogs, sorting/reordering, menus) with `"use client"`.
- Use route-level `loading.tsx`, `error.tsx`, and `not-found.tsx` files.
- Add React Hook Form and Zod for complex forms. Add TanStack Query only for interactive client-side mutations/cache invalidation; do not introduce it for simple server-rendered reads.

## Implemented backend API surface

All `/api/v1/*` administrative endpoints require a validated Keycloak access token. FastAPI enforces the stated permission.

### Session

| Endpoint | Frontend use |
| --- | --- |
| `GET /api/v1/me` | Establish the local application user after Keycloak login. |

### Clinics and membership

| Endpoint | Permission / access | Frontend use |
| --- | --- | --- |
| `GET /api/v1/clinics` | Platform admin: all; otherwise clinics with `clinic.read` | Clinic switcher/list. |
| `POST /api/v1/clinics` | `clinic.create` | New-clinic form. |
| `GET /api/v1/clinics/{clinic_id}` | clinic-scoped `clinic.read` | Clinic detail. |
| `PATCH /api/v1/clinics/{clinic_id}` | `clinic.create` | Edit clinic details. |
| `GET /api/v1/clinics/{clinic_id}/members` | `role.assign` | Member table. |
| `POST /api/v1/clinics/{clinic_id}/members` | `role.assign` | Add member. |
| `DELETE /api/v1/clinics/{clinic_id}/members/{user_id}` | `role.assign` | Remove member. |
| `GET /api/v1/clinics/{clinic_id}/survey-versions` | clinic-scoped `clinic.read` | Assigned-version table. |
| `POST /api/v1/clinics/{clinic_id}/survey-versions/{survey_version_id}/assign` | `survey.assign` | Assign published version. |
| `POST /api/v1/clinics/{clinic_id}/survey-versions/{survey_version_id}/unassign` | `survey.assign` | Unassign published version. |

### Users, roles, and audit history

| Endpoint | Permission | Frontend use |
| --- | --- | --- |
| `GET /api/v1/users` | `user.manage` | User picker/table. |
| `GET /api/v1/users/{user_id}` | `user.manage` | User detail. |
| `POST /api/v1/users` | `user.manage` | Provision platform user. |
| `POST /api/v1/admin-users` | platform admin | Provision platform administrator. |
| `PUT /api/v1/users/{user_id}/roles/platform-admin` | platform admin | Grant platform-admin role. |
| `POST /api/v1/users/{user_id}/deactivate` | `user.manage` | Deactivate user after confirmation. |
| `GET /api/v1/roles` | `role.assign` | Role selector. |
| `GET /api/v1/permissions` | `role.assign` | Read-only permissions reference. |
| `GET /api/v1/audit-events?clinic_id=&limit=` | `audit.view` | Audit timeline; metadata is intentionally not returned. |

### Surveys

Use the existing `/api/v1/surveys` endpoints for catalogue management, drafts, sections, questions, options, validations, publishing, copying, archive/restore, and published-version reads. Refer to FastAPI `/docs` in development for exact request schemas while implementing the typed API client.

Supported question types are single choice, multiple choice, yes/no, rating/scale, short text, long text, number, and date. Published versions are immutable.

## Routes to build

```text
app/
├─ (auth)/
│  ├─ login/page.tsx
│  ├─ auth/callback/route.ts
│  └─ access-denied/page.tsx
├─ (platform)/
│  ├─ layout.tsx                  # authenticated app shell
│  ├─ page.tsx                    # small useful landing page, not analytics
│  ├─ surveys/
│  │  ├─ page.tsx
│  │  ├─ new/page.tsx
│  │  └─ [surveyId]/
│  │     ├─ page.tsx
│  │     ├─ drafts/[draftId]/page.tsx
│  │     └─ versions/[versionNumber]/page.tsx
│  ├─ clinics/
│  │  ├─ page.tsx
│  │  └─ [clinicId]/page.tsx
│  └─ administration/
│     ├─ users/page.tsx
│     ├─ roles/page.tsx
│     └─ audit/page.tsx
├─ api/                            # narrow Next.js BFF/proxy handlers if selected
├─ loading.tsx
├─ error.tsx
└─ not-found.tsx
```

Do not expose phase-3 navigation as a functional feature. It may appear later as a clearly unavailable item, but campaign/public-response routes must not be invented now.

## Delivery order

### Milestone 1 — application foundation

1. Set frontend environment documentation and runtime validation.
2. Add the Keycloak login, callback, logout, session, and `/api/v1/me` access check.
3. Create the responsive platform shell: sidebar, header, profile menu, breadcrumbs, loading/error/empty states.
4. Add the typed API client and shared domain types.

**Acceptance:** a provisioned user signs in, sees the protected shell, and a non-provisioned Keycloak user cannot access it.

### Milestone 2 — survey catalogue

1. Implement list, create, rename, copy, archive, and restore workflows.
2. Show drafts and published versions from survey detail.
3. Gate actions based on known permissions, while relying on API errors as the authoritative result.

**Acceptance:** an authorized user can create a survey and reach its initial draft.

### Milestone 3 — draft survey builder

1. Render draft sections/questions from the draft-detail response.
2. Add section and question create/edit/delete workflows.
3. Implement choice options and validation rules conditionally by question type.
4. Use accessible up/down reorder buttons first; defer drag-and-drop until the stable workflow works.
5. Add a read-only preview and explicit publish confirmation.

**Acceptance:** create a complete draft, publish it, and view the immutable version.

### Milestone 4 — clinics and assignments

1. Build clinic list/detail/create/edit screens.
2. Add member list/add/remove workflow using the user and role selectors.
3. Add assigned published-version list and assign/unassign workflow.

**Acceptance:** assign one published version to a clinic end to end.

### Milestone 5 — platform administration

1. Build user list/detail/provision/deactivate screens.
2. Add platform-admin provisioning/promotion behind appropriate warnings and confirmations.
3. Add roles/permissions reference and audit-event list with a clinic filter.

**Acceptance:** permitted administrators can complete every implemented Phase 1 administrative API workflow through the UI.

## shadcn/ui conventions

- Check installed components before adding anything. Read component documentation before using a new shadcn component.
- Use `Card` composition, `FieldGroup`/`Field` form layout, `AlertDialog` for destructive actions, `Empty` for empty states, `Skeleton` for loading, and `sonner` for feedback.
- Keep TypeScript and JSX conventionally formatted: use multiline imports, props, component returns, and nested markup. Do not introduce compressed one-line JSX trees or component bodies.
- Use semantic design tokens and component variants; do not hard-code color utilities for UI meaning.
- Use `gap-*`, not `space-x-*` or `space-y-*`.
- Use `lucide-react` icons. Icons in buttons use the shadcn `data-icon` convention.

## Tests and verification

- Run `npm run lint` after each milestone.
- Run `npm run build` before handoff.
- Add unit tests for API error mapping, session/access checks, and form validation.
- Add browser tests for: login/access denial, survey create → edit → publish, clinic-version assignment, and user deactivation confirmation.
- Before calling an API complete, confirm the FastAPI behavior in development OpenAPI docs and verify successful/403/validation-error states.

## Progress log

Update this section at the end of each frontend session.

| Date | Completed | Verification | Next |
| --- | --- | --- | --- |
| 2026-09-15 | Next.js app created; shadcn/ui initialised. | User-confirmed setup; no frontend workflows implemented yet. | Milestone 1: auth, API boundary, and app shell. |
| 2026-09-15 | Replaced the starter route with a responsive German dashboard prototype. The route, shell, header, sidebar, visual sections, and prototype data are separated; the dashboard intentionally has no authentication or API calls yet. | `npm.cmd run lint` completed successfully; production build follows. | Implement Milestone 1 authentication and session/API boundary, then place this shell behind protected routing. |
| 2026-09-15 | Added OIDC Authorization Code + PKCE routes, HTTP-only session cookies, server-only `/api/v1/me` client, access-denied state, logout route, environment template, and protected `(platform)` route group. | Static review only; Keycloak browser-client configuration is still required for an end-to-end login. | Configure `umfrage-frontend` in Keycloak, add local frontend environment values, then manually validate login, denied access, and logout. |
| 2026-09-15 | Completed the authenticated foundation and initial user-administration slice: Keycloak PKCE login, local access validation, dynamic current-user identity, server-side user list/provisioning, duplicate-submit handling, deactivation, and platform-admin-only permanent delete. Removed static dashboard prototype data and rebuilt the Docker backend to expose current user-list and deletion routes. | Manual login, access-denied, provisioning, and live backend route checks completed. Permanent delete was verified only as an authenticated-route check; no real account was deleted as a test. | Next API-backed functionality: align backend authorization to the all-clinics access policy, then build clinic list and clinic detail. User-management follow-up remains: reactivation endpoint/UI and administrator demotion. |
| 2026-09-15 | Added user reactivation end to end: Keycloak account re-enable, local `is_active` restore, audit event, protected API route, and Users-screen action for deactivated records. | Rebuilt Docker backend; unauthenticated route check returns `401`, confirming the live route is protected. | Align backend authorization to the all-clinics access policy, then build clinic list and clinic detail. Administrator demotion remains a later user-management task. |
| 2026-09-15 | Added API-backed clinic navigation, overview count/entry point, clinic card list, and read-only clinic-profile route. | New files pass targeted ESLint; `npm run build` passes. The global lint command remains blocked by pre-existing errors in `components/ui/carousel.tsx` and `hooks/use-mobile.ts`, plus an unused import in the existing administration user page. | Align backend detail authorization with the all-clinics policy; then add clinic create/edit, members, and survey-version assignments. |
| 2026-09-15 | Added clinic creation and editing routes with a shared accessible form, server-side payload validation, API mutation client, audit-backed backend calls, and German success/error states. | New files pass targeted ESLint; `npm run build` passes with `/clinics/new` and `/clinics/[clinicId]/edit` routes. | Add clinic members and published survey-version assignments; align backend detail authorization with the all-clinics policy. |
| 2026-09-15 | Added clinic-member management: the clinic profile now lists members, assigns an active user and clinic role, and removes a membership behind a confirmation dialog. It only displays when the current user can retrieve the required administrative data. | New files pass targeted ESLint; `npm run build` passes. | Add published survey-version assignments; align backend detail authorization with the all-clinics policy. |
| 2026-09-15 | Added active published-survey-version assignment management to clinic profiles. Users can see assignments, select an unassigned published version, assign it, and confirm removal; the UI explicitly explains that future campaigns bind to this immutable version. | New files pass targeted ESLint; `npm run build` passes. | Align backend detail authorization with the all-clinics policy, then build the survey catalogue and builder UI before Phase 3 campaign work. |
| 2026-09-15 | Removed clinic-member controls from the UI and replaced them with a “Demnächst” state because clinic membership is outside the current all-clinics access policy. Aligned backend clinic list/detail and clinic-survey-version access checks so active platform users are no longer gated by `clinic_members`; global mutation permissions remain in force. | Targeted ESLint and `npm run build` pass; backend route-registration test passes in `backend/.venv`. | Build the survey catalogue and builder UI before Phase 3 campaign work. |
| 2026-09-15 | Started the survey catalogue UI: sidebar navigation, catalogue list, creation flow, survey detail, metadata editing, archive/restore, and draft/published-version summaries. | Targeted ESLint passed. Production build compilation and TypeScript passed; the runner did not return its final static-page stage before timing out. | Add survey copy, then implement the draft builder (sections, questions, options, validations, preview, and publish). |
| 2026-09-15 | Added the first usable draft-builder slice. Each survey draft is reachable from the survey detail page and supports creating, editing, deleting, and accessible up/down reordering of sections through the existing protected API. | Targeted ESLint and `tsc --noEmit` pass. | Add questions to each draft section, then choices, validation rules, preview, and publish confirmation. |
| 2026-09-15 | Fixed draft-section deletion by submitting the confirmed action through a real form. Added draft question rendering plus create, edit, required-state, and delete workflows for every section and all supported backend question types. | Targeted ESLint and `tsc --noEmit` pass. | Add question ordering, choices, validation rules, preview, and publish confirmation. |
| 2026-09-16 | Completed the Phase-2 draft-builder workflow: accessible question and option ordering; visible, editable choice options; validation-rule CRUD per supported question type; respondent-style preview; explicit publishing confirmation; and read-only published-version pages. | `tsc --noEmit`, targeted ESLint, and `git diff --check` pass. Production build is blocked because the sandbox cannot retrieve the pre-existing Google Geist font imports from `fonts.googleapis.com`. | Manually exercise a complete draft → preview → publish → immutable-version read flow, then continue with the remaining Phase-2 copy/draft-creation workflows or begin Phase 3 backend work. |
