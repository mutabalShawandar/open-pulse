# Security policy

## Supported versions

OpenPulse is pre-1.0. Security fixes are made on the `main` branch only. The project currently targets local, self-hosted use and is **not production-ready**; see [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md) for what is still open.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Include:

- what the problem is and which component it affects,
- steps to reproduce it, or a proof of concept,
- the impact you think it has,
- the version or commit you tested.

You can expect an acknowledgement within a few days. Please give us reasonable time to fix the issue before disclosing it publicly. We will credit you in the fix unless you prefer to stay anonymous.

## What is in scope

- Authentication and authorization bypasses, including access across workspaces or organizations.
- Injection issues, for example in exports, email templates, or survey content.
- Exposure of respondent data, recipient addresses, tokens, or SMTP credentials.
- Weaknesses in the public survey endpoints, such as token or slug guessing, or rate-limit bypass.

## What is out of scope

- Findings that only apply to the development defaults in `.env.example` and the local Keycloak realm (they are published on purpose and must never be used outside a local machine).
- Missing hardening that the readiness checklist already lists as open work.
- Denial of service through unrealistic resource use against a local development stack.
