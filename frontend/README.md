# OpenPulse frontend

The Next.js (App Router) administration and participant interface for OpenPulse. It talks to the FastAPI backend in `../backend` and authenticates platform users through Keycloak using the Authorization Code flow with PKCE.

For setup, run the whole stack from the repository root with `docker compose up` (see the [root README](../README.md)). The frontend is then available at http://localhost:3000.

## Working on the frontend

With the rest of the stack running, you can run the frontend outside Docker:

```bash
npm ci
npm run dev
```

You need the environment variables from the repository's `.env.example` (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_ROOT_DOMAIN`, `APP_URL`, `KEYCLOAK_ISSUER`, `KEYCLOAK_FRONTEND_CLIENT_ID`).

| Command                                   | What it does                        |
| ----------------------------------------- | ----------------------------------- |
| `npm run lint`                            | ESLint                              |
| `npm run format` / `npm run format:check` | Prettier (write / check)            |
| `npm run typecheck`                       | Generate route types and type-check |
| `npm test`                                | Vitest unit and page tests          |
| `npm run build`                           | Production build                    |

CI runs lint, the format check, the type check, and the build on every pull request.

## Translations

User-facing text lives in `messages/en.json` and `messages/de.json` and is loaded with [`next-intl`](https://next-intl.dev). English is the default and German is selectable from the language switcher. Both files must have the same keys. Add new keys to both files, and avoid hard-coding user-facing strings in components or server actions.

## Structure

- `app/` routes: `(auth)` for login and access-denied, `(platform)` for the signed-in application, `respond/[slug]` for the public survey, `api/` for export downloads.
- `components/` UI, with shadcn/ui primitives in `components/ui/`.
- `lib/` API client, authentication and session helpers, and shared utilities.
- `FRONTEND_PLAN.md` records scope, decisions, and a session log.
