<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project-specific frontend instructions

Read `FRONTEND_PLAN.md` before starting frontend work. It is the source of truth for the currently implemented backend API surface, scope boundaries, architecture decisions, and session progress log.

## Current status

- Next.js 16 App Router application exists in this directory.
- shadcn/ui is initialised with the `base-nova` style, Base UI primitives, Tailwind CSS 4, `lucide-react`, and the `@/*` alias.
- No application pages, authentication flow, FastAPI client, or platform workflows have been implemented yet.
- Backend Phases 1 and 2 are available. Phase 3 campaigns and public responses are not available and must not be represented as working frontend features.

## Working conventions

- Read the versioned Next.js documentation in `node_modules/next/dist/docs/` relevant to the task before modifying Next.js code.
- Use Server Components by default; use `"use client"` only for browser state or event handlers.
- Reuse installed shadcn components. Before adding or using a new shadcn component, inspect the local component and its current documentation.
- Use `FieldGroup` and `Field` for forms, `AlertDialog` for destructive actions, semantic design tokens, `gap-*` spacing, and `sonner` for toasts.
- Keep Keycloak tokens out of local storage. FastAPI remains authoritative for permissions.
- Keep application UI copy in German.

## Progress maintenance

At the end of each frontend session, update the **Progress log** in `FRONTEND_PLAN.md` with completed work, verification performed, and the next concrete task.
