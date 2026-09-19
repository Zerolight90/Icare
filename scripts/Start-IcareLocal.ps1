param(
    [Parameter(Mandatory = $true)][ValidateSet('backend','frontend')][string]$Service,
    [string]$EnvFile = (Join-Path $PSScriptRoot '../.env'),
    [switch]$CheckOnly,
    [switch]$Webpack
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Read-IcareEnv.ps1')
$values = Read-IcareEnv -Path $EnvFile
$required = if ($Service -eq 'backend') {
    @('ICARE_DB_URL','ICARE_DB_USER','ICARE_DB_PASSWORD','JWT_SECRET','ICARE_PROXY_SECRET','GEMINI_API_KEY','ICARE_UPLOAD_DIR','ICARE_REDIS_PASSWORD')
} else { @('BACKEND_URL','ICARE_FRONTEND_ORIGIN','ICARE_PROXY_SECRET') }
foreach ($name in $required) {
    if ([string]::IsNullOrWhiteSpace($values[$name])) { throw "Missing $name in env file" }
}
foreach ($name in @('JWT_SECRET','ICARE_PROXY_SECRET')) {
    if ($values.ContainsKey($name) -and [Text.Encoding]::UTF8.GetByteCount($values[$name]) -lt 32) { throw "$name must contain at least 32 bytes" }
}
if ($Service -eq 'frontend') { $values = Get-IcareFrontendEnv -Values $values }
if ($CheckOnly) { "Required $Service settings present; no values printed and no service started."; return }
$previous = @{}
try {
    foreach ($name in $values.Keys) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
    }
    if ($Service -eq 'backend') {
        $previous['SPRING_PROFILES_ACTIVE'] = [Environment]::GetEnvironmentVariable('SPRING_PROFILES_ACTIVE','Process')
        $env:SPRING_PROFILES_ACTIVE = 'private'
        Push-Location (Join-Path $PSScriptRoot '../babychatboot_backend/parenting')
        try { & ./mvnw.cmd spring-boot:run } finally { Pop-Location }
    } else {
        Push-Location (Join-Path $PSScriptRoot '../babychatboot_frontend/chat-frontend')
        try {
            $devArgs = @('run','dev','--','--hostname','127.0.0.1')
            if ($Webpack) { $devArgs += '--webpack' }
            & npm.cmd @devArgs
        } finally { Pop-Location }
    }
    if ($LASTEXITCODE -ne 0) { throw "$Service stopped with exit code $LASTEXITCODE" }
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
}
