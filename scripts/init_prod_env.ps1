[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet("staging", "production")]
    [string]$Target,

    [Parameter(Mandatory)]
    [string]$Domain,

    [string]$SmtpUsername,

    [securestring]$SmtpPassword
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$template = Join-Path $root ".env.$Target.example"
$output = Join-Path $root ".env.$Target"

if (-not (Test-Path -LiteralPath $template)) {
    throw "Missing template: $template"
}

if (-not (Test-Path -LiteralPath $output)) {
    Copy-Item -LiteralPath $template -Destination $output
}

$content = Get-Content -LiteralPath $output -Raw

function Get-Value([string]$Name) {
    $match = [regex]::Match($script:content, "(?m)^$([regex]::Escape($Name))=(.*)$")
    if ($match.Success) { return $match.Groups[1].Value }
    return $null
}

function Set-Value([string]$Name, [string]$Value, [bool]$OnlyWhenUnset = $false) {
    $current = Get-Value $Name
    $unset = [string]::IsNullOrWhiteSpace($current) -or $current -match "^(REPLACE|CHANGE|<)"
    if ($OnlyWhenUnset -and -not $unset) { return }

    $pattern = "(?m)^$([regex]::Escape($Name))=.*$"
    $line = "$Name=$Value"
    if ([regex]::IsMatch($script:content, $pattern)) {
        $script:content = [regex]::Replace($script:content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $line })
    } else {
        $script:content = $script:content.TrimEnd() + [Environment]::NewLine + $line + [Environment]::NewLine
    }
}

function New-UrlSafeSecret([int]$Bytes = 32) {
    $buffer = New-Object byte[] $Bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return [Convert]::ToBase64String($buffer).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function New-FernetKey {
    $buffer = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return [Convert]::ToBase64String($buffer).Replace("+", "-").Replace("/", "_")
}

function Convert-SecureStringToPlainText([securestring]$Value) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

if ([string]::IsNullOrWhiteSpace($SmtpUsername)) {
    $existingSmtpUser = Get-Value "KEYCLOAK_SMTP_USERNAME"
    if ([string]::IsNullOrWhiteSpace($existingSmtpUser) -or $existingSmtpUser -match "^(REPLACE|CHANGE|<)") {
        $SmtpUsername = Read-Host "Kasserver SMTP mailbox address"
    }
}

if ($null -eq $SmtpPassword) {
    $existingSmtpPassword = Get-Value "KEYCLOAK_SMTP_PASSWORD"
    if ([string]::IsNullOrWhiteSpace($existingSmtpPassword) -or $existingSmtpPassword -match "^(REPLACE|CHANGE|<)") {
        $SmtpPassword = Read-Host "Kasserver SMTP mailbox password" -AsSecureString
    }
}

$isStaging = $Target -eq "staging"
$appHost = if ($isStaging) { "staging-app.$Domain" } else { "app.$Domain" }
$apiHost = if ($isStaging) { "staging-api.$Domain" } else { "api.$Domain" }
$authHost = if ($isStaging) { "staging-auth.$Domain" } else { "auth.$Domain" }
$realm = if ($isStaging) { "Umfrage-staging" } else { "Umfrage" }
$importDirectory = if ($isStaging) { "realm-staging" } else { "realm" }
$domainForRegex = $Domain.Replace(".", "\.")
$corsOriginRegex = if ($isStaging) { "https://staging-[a-z0-9-]+\.$domainForRegex" } else { "https://([a-z0-9-]+\.)?$domainForRegex" }

Set-Value "APP_URL" "https://$appHost"
Set-Value "PUBLIC_FRONTEND_URL" "https://$appHost"
Set-Value "PUBLIC_BACKEND_URL" "https://$apiHost"
Set-Value "NEXT_PUBLIC_API_BASE_URL" "https://$apiHost"
Set-Value "NEXT_PUBLIC_ROOT_DOMAIN" $Domain
Set-Value "PUBLIC_ROOT_DOMAIN" $Domain
Set-Value "CORS_ORIGINS" "https://$appHost"
Set-Value "CORS_ORIGIN_REGEX" $corsOriginRegex
Set-Value "KEYCLOAK_URL" "https://$authHost"
Set-Value "KEYCLOAK_ISSUER" "https://$authHost/realms/$realm"
Set-Value "KEYCLOAK_REALM" $realm
Set-Value "KEYCLOAK_REALM_IMPORT_DIR" $importDirectory
Set-Value "KEYCLOAK_AUDIENCE" "umfrage-api"

foreach ($name in @(
    "APP_POSTGRES_PASSWORD",
    "KEYCLOAK_POSTGRES_PASSWORD",
    "KEYCLOAK_ADMIN_CLIENT_SECRET",
    "KC_BOOTSTRAP_ADMIN_PASSWORD",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY"
)) {
    Set-Value $name (New-UrlSafeSecret) $true
}
Set-Value "EMAIL_CREDENTIAL_ENCRYPTION_KEY" (New-FernetKey) $true

Set-Value "KEYCLOAK_SMTP_HOST" "w00de7f6.kasserver.com" $true
Set-Value "KEYCLOAK_SMTP_PORT" "465" $true
Set-Value "KEYCLOAK_SMTP_AUTH" "true" $true
Set-Value "KEYCLOAK_SMTP_SSL" "true" $true
Set-Value "KEYCLOAK_SMTP_STARTTLS" "false" $true
if (-not [string]::IsNullOrWhiteSpace($SmtpUsername)) {
    Set-Value "KEYCLOAK_SMTP_USERNAME" $SmtpUsername $true
    Set-Value "KEYCLOAK_SMTP_FROM" $SmtpUsername $true
}
if ($null -ne $SmtpPassword) {
    Set-Value "KEYCLOAK_SMTP_PASSWORD" (Convert-SecureStringToPlainText $SmtpPassword) $true
}

Set-Content -LiteralPath $output -Value $content -NoNewline
Write-Host "Created or updated $output. Secret values were not displayed."
