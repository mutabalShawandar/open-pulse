# Phase 2 Roadmap: Agency Survey Catalogue and Builder

Phase 2 builds the reusable survey catalogue for a survey agency. A survey is created once at agency level, can have multiple immutable published versions, and each published version can be assigned to one or many clinics. Different clinics can therefore run different versions of the same survey.

Phase 2 excludes campaigns, public response links, recipients, email delivery, analytics, and exports. Those phases will select one exact assigned `survey_version_id`; they must never rely on a mutable survey or “latest version”.

## Completion Criteria

- Surveys are agency-wide catalogue records, not clinic-owned records.
- A survey can have multiple labelled drafts and any number of immutable published versions.
- An agency user can copy a survey or create a draft copied from an existing draft or published version.
- A published version can be actively assigned to many clinics.
- A clinic can be assigned different versions of the same survey over time or, where business rules allow it, concurrently.
- Catalogue users can build, validate, publish, archive, and restore surveys.
- Clinic-scoped users can see only versions assigned to their clinics.
- Publishing, assignment, unassignment, archive, and restore actions are audited.
- Tests cover version immutability, authorization, clinic isolation, and assignment rules.

Run backend commands from:

~~~powershell
cd C:\Users\you\open-pulse-work\backend
uv run <command>
~~~

## Core Model

### Lifecycle

~~~text
survey:          draft -> published -> archived
survey version:  draft -> published (immutable)
assignment:      active -> unassigned
~~~

- `surveys` is the long-lived agency catalogue container. It has no `clinic_id`.
- `survey_versions` owns the respondent-facing content. It belongs to one survey, has a `draft` or `published` status, and records an optional `based_on_version_id` for its source version.
- A survey may have multiple labelled drafts. A draft is created explicitly by copying a selected draft or published version; its sections, questions, options, and validation rules receive new IDs.
- Publishing validates the selected draft and freezes it as the next sequential published version. It does not automatically create another draft.
- Published versions are never changed or deleted in normal operations.
- `survey_version_clinics` is the explicit assignment junction. It links a published version with a clinic and stores who assigned it and when.
- Unassigning prevents new campaigns from selecting that version for the clinic. It must not modify or invalidate existing campaigns and their historical responses.
- Archive is the normal endpoint for a survey that has published versions, assignments, campaigns, or responses; no hard deletion in Phase 2.

The agency decides which version each clinic may use. For example, clinic A can retain version 1 while clinic B receives version 2. One version can also be assigned to both clinics. If a questionnaire needs a permanent independent variant, copy the whole survey into a new catalogue survey rather than creating an unbounded version history.

## Authorization Model

The Phase 1 membership model remains the tenant boundary for clinic data. The agency catalogue needs a separate, explicit authorization decision because it is intentionally not scoped to a clinic.

Add and seed these permissions in a new migration:

| Action | Permission and scope |
| --- | --- |
| List/read agency catalogue | `survey.read` — agency-wide |
| Create/edit/archive catalogue surveys | `survey.create` / `survey.edit` — agency-wide |
| Publish a version | `survey.publish` — agency-wide |
| Assign/unassign a version | `survey.assign` — agency-wide, plus membership in the target clinic |
| List a clinic's assigned versions | `clinic.read` — target clinic |

Implement an agency-level permission service using the Phase 1 local user-role tables. Retain `require_clinic_permission` for operations in a clinic context. Do not use a client-provided clinic ID as proof that a user may assign a version there.

## Step 1: Add the Survey Schema

Create SQLAlchemy models and one reviewed Alembic migration for:

| Table | Purpose | Important fields |
| --- | --- | --- |
| `surveys` | Agency catalogue container | `id`, `title`, `description`, `status`, `created_by_user_id`, timestamps, `archived_at` |
| `survey_versions` | Draft or published versioned content | `id`, `survey_id`, `version_number` nullable until published, `status`, `draft_label`, `based_on_version_id`, `published_at`, `created_by_user_id` |
| `survey_version_clinics` | Published-version assignment | `id`, `survey_version_id`, `clinic_id`, `assigned_by_user_id`, `assigned_at`, `unassigned_at` |
| `survey_sections` | Ordered groups per version | `id`, `survey_version_id`, `title`, `description`, `position` |
| `survey_questions` | Ordered typed questions | `id`, `section_id`, `question_type`, `title`, `help_text`, `is_required`, `position` |
| `survey_question_options` | Choices where applicable | `id`, `question_id`, `label`, `value`, `position` |
| `survey_question_validations` | Type-specific rules | `id`, `question_id`, `rule_type`, `rule_value` |

Use UUID keys, timezone-aware timestamps, explicit status and question-type enums, and foreign keys. Add these integrity constraints:

- Unique `(survey_id, version_number)` on `survey_versions` for non-null published version numbers.
- `based_on_version_id` references `survey_versions.id`; source and copy must belong to the same survey for draft copying.
- Draft labels need only be unique per survey if the product UI requires it; do not add a one-draft-per-survey constraint.
- One active `(survey_version_id, clinic_id)` assignment, enforced with a partial unique index where `unassigned_at IS NULL`.
- Unique section, question, and option positions within their parents.
- Unique option values per question and validation rule types per question.

Only published versions may be assigned. Enforce this in the service layer; use a database trigger too if the project adopts triggers for cross-table state invariants.

~~~powershell
uv run alembic revision --autogenerate -m "add agency survey catalogue"
uv run alembic upgrade head
uv run alembic current
~~~

Never amend already-applied Phase 1 migrations.

## Step 2: Module Boundaries and API Contracts

Create:

~~~text
app/models/survey.py
app/schemas/survey.py
app/repositories/survey_repository.py
app/services/survey_service.py
app/api/v1/surveys.py
~~~

Keep routes limited to HTTP concerns. Services own authorization, state transitions, transactions, and audit logging. Repositories own scoped database queries. Pydantic schemas—not ORM objects—form the API contract.

Provide catalogue endpoints under `/api/v1/surveys`:

~~~text
GET    /                              List agency surveys
POST   /                              Create survey and first draft
GET    /{survey_id}                   Read survey and published/draft summaries
PATCH  /{survey_id}                   Update survey metadata
POST   /{survey_id}/archive
POST   /{survey_id}/restore
POST   /{survey_id}/drafts                  Create an empty draft or copy a selected version
GET    /{survey_id}/drafts                  List drafts
GET    /{survey_id}/drafts/{draft_id}       Read one editable draft
POST   /{survey_id}/copy                    Copy this survey into a new independent survey
POST   /{survey_id}/drafts/{draft_id}/publish
GET    /{survey_id}/versions
GET    /{survey_id}/versions/{version_number}
~~~

Provide nested draft endpoints for sections, questions, options, validation rules, and full-list reordering, with `{draft_id}` in the route. Every mutation must target a draft; published-version mutation returns `409 Conflict`.

Expose assignments separately from the catalogue:

~~~text
GET  /api/v1/clinics/{clinic_id}/survey-versions
POST /api/v1/clinics/{clinic_id}/survey-versions/{survey_version_id}/assign
POST /api/v1/clinics/{clinic_id}/survey-versions/{survey_version_id}/unassign
~~~

The clinic endpoint returns only active assignments for that clinic. It must never reveal drafts, unassigned versions, or another clinic’s assignments.

## Step 3: Draft Editing and Validation

Support initially: `single_choice`, `multiple_choice`, `yes_no`, `rating`, `short_text`, `long_text`, `number`, and `date`.

At publish time, validate the complete hierarchy:

- At least one non-empty section and one valid question.
- Non-empty question titles and valid sibling order.
- Choice types have at least two distinct non-empty options.
- `yes_no` has no editable options.
- Rating has integer minimum and maximum values where minimum is less than maximum.
- Text lengths, number bounds, date bounds, and multiple-choice selection limits are internally consistent.
- Unsupported rules and options for incompatible question types are rejected.

Allow incomplete drafts while editing, but return `422 Unprocessable Entity` with field-level errors when a draft cannot be published. Store structured validation values only after schema validation; never persist arbitrary client JSON as rules.

## Step 4: Immutable Publishing

The publishing service runs one transaction:

1. Require agency-wide `survey.publish`.
2. Lock the survey and selected draft against concurrent publication.
3. Load and fully validate its sections, questions, options, and rules.
4. Assign the next published version number and freeze the selected draft.
5. Update the survey lifecycle status and write `survey.published` audit data containing only IDs, version number, and counts.
6. Commit and return the published version. A later explicit copy operation creates any new draft.

Publishing does not assign the version automatically. Assignment is a deliberate agency decision made afterwards, preventing accidental rollout of a changed questionnaire across clinics.

## Step 5: Clinic Assignment

Assignment requires both agency-wide `survey.assign` and verified membership in the target clinic. The service must:

1. Confirm the version is published and the survey is not archived.
2. Confirm target-clinic access without leaking information about other clinics.
3. Create or reactivate exactly one active assignment.
4. Audit `survey_version.assigned` with only IDs and version number.

Unassignment is soft (`unassigned_at`), idempotent, and audited as `survey_version.unassigned`. Do not cascade-delete assignments from published versions.

Phase 2 permits multiple active versions of one survey for a clinic because different programmes may require it. Phase 3 campaign creation will require an exact assigned version. If the agency later requires “only one active version per survey per clinic,” add that as an explicit business rule and partial unique index in a later migration—do not assume it now.

## Step 6: Audit and Error Contracts

Audit: `survey.created`, `survey.updated`, `survey.published`, `survey.archived`, `survey.restored`, `survey_version.assigned`, and `survey_version.unassigned`.

Metadata may contain IDs, version numbers, and item counts. It must never contain question text, option labels, tokens, recipient data, or responses.

- `403`: caller lacks required agency permission or target-clinic membership.
- `404`: resource is absent from the accessible hierarchy.
- `409`: mutation of a published version, invalid lifecycle transition, archive conflict, or concurrent state conflict.
- `422`: valid request shape but invalid builder or publish rule.

## Step 7: Tests and Quality Gates

Unit tests must cover type validation, deep-copy independence, copying a whole survey, copying a draft from a source version, draft labels, reordering, published-version numbering, and every prohibited lifecycle transition.

Integration/API tests must prove:

- A complete create → publish → assign flow works.
- Publishing version 2 does not change version 1.
- Multiple drafts of a survey can coexist; publishing one leaves the others editable and unchanged.
- Copying a survey produces a new survey with independent version, section, question, option, and validation IDs.
- Version 1 can be assigned to clinic A while version 2 is assigned to clinic B.
- One published version can be assigned to both clinics.
- Draft/unpublished versions cannot be assigned.
- Users without a target-clinic membership cannot list or change its assignments.
- A clinic endpoint does not reveal another clinic’s assignments.
- Assignment and publication create safe audit records.
- Concurrent publish requests cannot create duplicate version numbers or multiple drafts.

Run before merging:

~~~powershell
uv run alembic upgrade head
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy app
~~~

## Delivery Slices

1. Catalogue schema, permissions, migration, and read models.
2. Catalogue survey CRUD, draft shell, authorization, and audit events.
3. Sections, questions, ordering, options, and validation-rule editing.
4. Explicit survey and draft copying, then publish transactions and immutable version reads.
5. Version-to-clinic assignment API, membership boundaries, and audit events.
6. End-to-end, concurrency, migration, and security hardening.

## Final Check

On a clean database, create one agency survey and two drafts. Publish the first as version 1 and assign it to clinic A. Copy version 1 into a new draft, adapt it, publish it as version 2, and assign it to clinic B while clinic A retains version 1. Copy the full survey into a separate agency survey and verify every copied child has an independent ID. Confirm each clinic sees only its assignments, published content remains immutable, unauthorized users cannot access another clinic’s assignments, and all administrative actions are safely audited.

After that verification, Phase 3 can create clinic campaigns that bind to one exact assigned published survey version.
