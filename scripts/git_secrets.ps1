[CmdletBinding()]
param(
    [string]$Repository = "bowdev2025/umfrage",

    [Parameter(Mandatory)]
    [string]$VpsHost,

    [string]$VpsUser = "deploy",

    [string]$VpsDeployPath = "/home/deploy/apps/umfrage",

    [string]$SshKeyPath = (Join-Path $env:USERPROFILE ".ssh\umfrage_github_actions"),

    [ValidateSet("staging", "production", "all")]
    [string]$Target = "all"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Set-EnvironmentSecret([string]$Environment, [string]$Name, [string]$Value) {
    $Value | gh secret set $Name --env $Environment --repo $Repository
    if ($LASTEXITCODE -ne 0) { throw "Unable to set $Name for $Environment." }
}

function Ensure-GitHubEnvironment([string]$Environment) {
    & gh api --method PUT "repos/$Repository/environments/$Environment" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Unable to create or access the $Environment GitHub Environment." }
}

gh auth status
if ($LASTEXITCODE -ne 0) {
    throw "Run 'gh auth login' first, then run this script again."
}

if (-not (Test-Path -LiteralPath $SshKeyPath)) {
    throw "Missing dedicated GitHub Actions SSH private key: $SshKeyPath"
}

$root = Split-Path -Parent $PSScriptRoot
$privateKey = Get-Content -LiteralPath $SshKeyPath -Raw
$knownHostsPath = Join-Path $env:USERPROFILE ".ssh\known_hosts"
if (-not (Test-Path -LiteralPath $knownHostsPath)) {
    throw "Missing $knownHostsPath. First connect once with 'ssh deploy@$VpsHost'."
}
$knownHosts = Get-Content -LiteralPath $knownHostsPath -Raw
if ([string]::IsNullOrWhiteSpace($knownHosts)) {
    throw "No SSH host keys exist in $knownHostsPath. First connect once with 'ssh deploy@$VpsHost'."
}

$environments = if ($Target -eq "all") { @("staging", "production") } else { @($Target) }

foreach ($environment in $environments) {
    Ensure-GitHubEnvironment $environment
    $environmentFile = Join-Path $root ".env.$environment"
    if (-not (Test-Path -LiteralPath $environmentFile)) {
        throw "Missing $environmentFile. Run init_prod_env.ps1 first."
    }

    $encodedEnvironmentFile = [Convert]::ToBase64String([IO.File]::ReadAllBytes($environmentFile))
    Set-EnvironmentSecret $environment "DEPLOY_ENV_FILE_B64" $encodedEnvironmentFile
    Set-EnvironmentSecret $environment "VPS_HOST" $VpsHost
    Set-EnvironmentSecret $environment "VPS_USER" $VpsUser
    Set-EnvironmentSecret $environment "VPS_DEPLOY_PATH" $VpsDeployPath
    Set-EnvironmentSecret $environment "VPS_SSH_PRIVATE_KEY" $privateKey
    Set-EnvironmentSecret $environment "VPS_KNOWN_HOSTS" $knownHosts
}

Write-Host "Uploaded deployment secrets for $($environments -join ', '). Secret values were not displayed."
