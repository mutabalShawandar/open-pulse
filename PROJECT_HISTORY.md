# Project history

OpenPulse is an independently developed open-source portfolio edition of a multi-tenant survey platform created by Omar Trabulsi.

The original system was developed as a private, client-specific deployment. OpenPulse is its deliberately generalized edition: client branding, private configuration, infrastructure details, data, recipient lists, and secrets are not included.

The Git history is intentionally retained to show the development timeline and engineering decisions behind the platform. The public edition adds a generic Organization tenant layer: each organization has member users and manages multiple client workspaces. It will use a new English-first OpenPulse brand.

## What this demonstrates

- Designing multi-tenant authorization and role-based permissions
- Building versioned survey content with immutable published versions
- Designing secure public response flows
- Delivering full-stack systems with Next.js, FastAPI, PostgreSQL, Keycloak, Redis, and Docker Compose
- Writing tests, migrations, deployment documentation, and operational configuration

This document describes provenance, not an affiliation with or endorsement by any client.
