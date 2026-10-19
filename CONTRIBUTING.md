# Contributing to OpenPulse

Thanks for your interest in OpenPulse. Bug reports, translations, UI fixes, tests, and documentation improvements are all welcome, and so are code contributions.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, please read [SECURITY.md](SECURITY.md) first and do not open a public issue.

## License

OpenPulse is open source under the MIT License. Your contributions are licensed under the same license.

## Where help is most useful

- **Translations:** review the German text, or add a language. See [Translations](#translations).
- **Tests:** the backend has unit and integration tests; the frontend uses Vitest (`npm test` in `frontend/`). Tests for edge cases are a good first contribution.
- **UI fixes and accessibility.**
- **Bug reports** with clear steps to reproduce.

Issues labelled `good first issue` are small and self-contained.

## Scope of v0.1

The first release is a **local, self-hosted** release for a **single organization**. Production deployment, multi-organization support, and identified (non-anonymous) responses are out of scope for now. If you want to work on something large, please open an issue to discuss it first so you do not spend time on a change that cannot be merged yet.

## Getting started

You need Docker Desktop (with Docker Compose) and Git. For working on the code outside Docker you also need [uv](https://docs.astral.sh/uv/) with Python 3.14, and Node.js 24.

```powershell
git clone https://github.com/<your-fork>/open-pulse.git
cd open-pulse
Copy-Item .env.example .env
docker compose up --build -d
```

Open http://localhost:3000 and sign in with the seeded local administrator described in the [README](README.md#local-setup). Emails sent by the application appear in Mailpit at http://localhost:8025. To start with demo data, use `docker compose --profile demo up --build -d`.

## Making a change

1. Fork the repository and create a branch from `main` (for example `fix/export-filename`).
2. Make a focused change. Smaller pull requests are reviewed faster.
3. Run the checks below and make sure they pass.
4. Open a pull request against `main` and fill in the template.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, optionally with a scope such as `fix(backend):`.

### Checks

Continuous integration runs these on every pull request. Running them locally first saves a round trip.

Backend (from `backend/`):

```powershell
uv sync --locked --all-groups
uv run ruff check .
uv run ruff format --check .
uv run pytest tests --ignore=tests/integration
```

The integration tests need a migrated PostgreSQL database (and Mailpit for the delivery test). The [README](README.md#development-and-tests) shows how to start both and run the full suite.

Frontend (from `frontend/`):

```powershell
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

### Tests

Add or update tests with your change. Bug fixes should include a test that fails without the fix. Tests that use the database run inside a transaction that is rolled back; see `backend/tests/integration/db.py` and `factories.py` for the helpers. Frontend tests live in `frontend/tests/`; they mock the session, the API client, and `next-intl`, so they need no running services. Translation changes are checked automatically: `en.json` and `de.json` must have the same keys and `{placeholders}`.

### Translations

All user-facing text lives in `frontend/messages/en.json` and `frontend/messages/de.json`, loaded with [next-intl](https://next-intl.dev). Both files must contain the same keys.

- To fix or improve a translation, edit the value in the relevant file.
- To add text to the interface, add the key to **both** files (English first) and use it from the component. Do not hard-code user-facing strings in components or server actions.
- To add a language, copy `en.json` to `<code>.json` and translate it, add the code to `locales` in `frontend/i18n/config.ts`, and add the language's name under the `language` key in every messages file (the language switcher reads `language.<code>`).

Exports (PDF and Excel) and the default email templates are English only at the moment.

### Code conventions

- Backend: Python 3.14, formatted and linted with `ruff`. Services hold business logic; routes stay thin.
- Frontend: TypeScript, Server Components by default, shadcn/ui components, Prettier formatting.
- Treat anything a respondent can submit as untrusted input. In particular, exports must never turn answers into formulas or markup.
- Do not commit secrets, real recipient data, or customer branding. The values in `.env.example` are for local development only.
- Naming: the product term is **workspace**. The REST paths (`/api/v1/clinics/...`) and some identifiers (`clinic_manager`) keep the old name for compatibility. Do not rename them in an unrelated change.

## Reporting bugs and requesting features

Use the issue templates. For bugs, include what you did, what you expected, what happened, and your environment (operating system, Docker version, browser). Logs from `docker compose logs <service>` help a lot.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
