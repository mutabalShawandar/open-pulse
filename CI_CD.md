# CI/CD setup

The committed workflow deploys only the `staging` branch automatically. A
production deployment must be manually started from `main` in GitHub Actions.
Both environments use the same VPS but separate Docker Compose project names,
volumes, databases, ports, networks, and Keycloak realms.

## Prerequisites

1. Create the `staging` branch and push it to GitHub.
2. Wait for the domain to resolve, then create Nginx/TLS sites for
   `staging-app`, `staging-api`, and `staging-auth` before the first staging
   deployment. Use distinct production sites later: `app`, `api`, and `auth`.
3. On the VPS, create the deployment directory, for example
   `/home/deploy/apps/umfrage`.
4. Create a dedicated SSH key for GitHub Actions. Do not upload a developer's
   personal SSH private key to GitHub. Add its public key to the VPS `deploy`
   user's `~/.ssh/authorized_keys`.

## GitHub environments and secrets

Create two GitHub Environments: `staging` and `production`. Add the following
secrets to **each** environment:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | `deploy` |
| `VPS_DEPLOY_PATH` | `/home/deploy/apps/umfrage` |
| `VPS_SSH_PRIVATE_KEY` | dedicated GitHub Actions SSH private key |
| `VPS_KNOWN_HOSTS` | pinned SSH host key for the VPS |
| `DEPLOY_ENV_FILE_B64` | base64 of `.env.staging` or `.env.production` |

Keep staging and production secrets separate, including every database,
Keycloak, SMTP, storage, and encryption credential in their environment file.
Configure production required approval in GitHub when the repository plan
supports environment protection rules.

## Bulk-upload secrets without pasting values

Run these commands in PowerShell from the repository after `gh auth login`.
They upload the complete environment file as one encrypted secret per GitHub
environment; no secret value is pasted into the GitHub website.

Create the environment files first. This needs no OpenSSL installation; the
script uses Windows PowerShell's built-in cryptography and prompts only for the
Kasserver mailbox address and password:

```powershell
.\scripts\Initialize-DeploymentEnvironment.ps1 -Target staging -Domain "yourdomain.de"
.\scripts\Initialize-DeploymentEnvironment.ps1 -Target production -Domain "yourdomain.de"
```

```powershell
$repo = "bowdev2025/umfrage"
$stagingEnv = [Convert]::ToBase64String([IO.File]::ReadAllBytes(".env.staging"))
$stagingEnv | gh secret set DEPLOY_ENV_FILE_B64 --env staging --repo $repo
$productionEnv = [Convert]::ToBase64String([IO.File]::ReadAllBytes(".env.production"))
$productionEnv | gh secret set DEPLOY_ENV_FILE_B64 --env production --repo $repo
```

Use the same pattern for the dedicated deployment key and pinned host key:

```powershell
$key = Get-Content -Raw "$env:USERPROFILE\.ssh\umfrage_github_actions"
$key | gh secret set VPS_SSH_PRIVATE_KEY --env staging --repo $repo
$key | gh secret set VPS_SSH_PRIVATE_KEY --env production --repo $repo
ssh-keyscan -H 85.215.165.178 | gh secret set VPS_KNOWN_HOSTS --env staging --repo $repo
ssh-keyscan -H 85.215.165.178 | gh secret set VPS_KNOWN_HOSTS --env production --repo $repo
```

Set the non-sensitive `VPS_HOST`, `VPS_USER`, and `VPS_DEPLOY_PATH` once per
environment with `gh secret set <NAME> --env <environment> --repo $repo`.

## Deployment behavior

```text
push to staging        -> test, migrate, deploy staging
push to main           -> test only
manual production run  -> test, migrate, deploy production from main
```

The workflow transfers only committed source files. It writes the environment
file from the selected GitHub Environment on the VPS, runs migrations as an
explicit job, and then starts application containers.
