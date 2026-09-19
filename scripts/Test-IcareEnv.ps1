$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Read-IcareEnv.ps1')
$fixtureDir = Join-Path $PSScriptRoot '../babychatboot_backend/parenting/target/env-parser-tests'
New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
$fixture = Join-Path $fixtureDir 'synthetic.env'
@'
# Synthetic values only
SMTP_PASSWORD='test $literal # is not a comment'
GEMINI_API_KEY=synthetic-api-key
JWT_SECRET=synthetic-jwt-secret-32-characters-minimum
BACKEND_URL=http://127.0.0.1:8080
ICARE_FRONTEND_ORIGIN=http://127.0.0.1:3000
ICARE_PROXY_SECRET=synthetic-proxy-secret-32-characters-minimum
CF_ACCESS_CLIENT_SECRET='test $literal'
ICARE_DB_PASSWORD=synthetic-database-password
NEXT_PUBLIC_KAKAO_MAP_KEY=synthetic-public-key
NEXT_PUBLIC_GEMINI_API_KEY=must-never-be-forwarded
'@ | Set-Content -LiteralPath $fixture -Encoding utf8
$values = Read-IcareEnv $fixture
if ($values.SMTP_PASSWORD -cne 'test $literal # is not a comment') { throw 'Literal credential changed' }
$frontend = Get-IcareFrontendEnv $values
foreach ($name in @('GEMINI_API_KEY','JWT_SECRET','ICARE_DB_PASSWORD','NEXT_PUBLIC_GEMINI_API_KEY')) {
    if ($frontend.ContainsKey($name)) { throw 'Backend-only or unexpected public variable reached frontend' }
}
if ($frontend.CF_ACCESS_CLIENT_SECRET -cne 'test $literal') { throw 'Server proxy credential changed' }
$before = [Environment]::GetEnvironmentVariable('ICARE_PROXY_SECRET','Process')
& (Join-Path $PSScriptRoot 'Start-IcareLocal.ps1') -Service frontend -EnvFile $fixture -CheckOnly | Out-Null
if ([Environment]::GetEnvironmentVariable('ICARE_PROXY_SECRET','Process') -cne $before) { throw 'Check-only changed the shell environment' }
foreach ($bad in @("JWT_SECRET=a`nJWT_SECRET=b", 'SMTP_PASSWORD=must-not-appear-in-errors $expanded')) {
    [IO.File]::WriteAllText($fixture,$bad)
    $rejected=$false
    try { Read-IcareEnv $fixture | Out-Null } catch {
        $rejected=$true
        if ($_.Exception.Message.Contains('must-not-appear-in-errors')) { throw 'Validation leaked value' }
    }
    if (!$rejected) { throw 'Unsafe or duplicate env syntax accepted' }
}
'Env parser, literal secrets, frontend allowlist, check-only isolation and invalid-input checks passed.'
