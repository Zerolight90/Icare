param(
    [Parameter(Mandatory = $true)][string]$InputFile,
    [Parameter(Mandatory = $true)][string]$OutputFile,
    [string]$EnvFile = (Join-Path $PSScriptRoot '../.env'),
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Read-IcareEnv.ps1')
$values = Read-IcareEnv -Path $EnvFile
$inputPath = (Resolve-Path -LiteralPath $InputFile).Path
$outputPath = [IO.Path]::GetFullPath($OutputFile)
if (Test-Path -LiteralPath $outputPath) { throw 'Use a new output file; prior reports are preserved.' }
if (-not (Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($outputPath)))) { throw 'Create the report directory first.' }
$previous = @{}
try {
    foreach ($name in $values.Keys) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
    }
    # Explicit settings override imported environment. No Flyway migration, seed, or admin creation.
    $batch = @{
        SPRING_PROFILES_ACTIVE = 'private'
        SPRING_FLYWAY_ENABLED = 'false'
        SERVER_ADDRESS = '127.0.0.1'
        SERVER_PORT = '0'
        ICARE_KNOWLEDGE_LOAD_ON_STARTUP = 'false'
        ICARE_ADMIN_BOOTSTRAP_ENABLED = 'false'
        ICARE_BOOTSTRAP_ENABLED = 'false'
        ICARE_KNOWLEDGE_BATCH_ENABLED = 'true'
        ICARE_KNOWLEDGE_BATCH_INPUT = $inputPath
        ICARE_KNOWLEDGE_BATCH_OUTPUT = $outputPath
        ICARE_KNOWLEDGE_BATCH_APPLY = $Apply.IsPresent.ToString().ToLowerInvariant()
    }
    foreach ($name in $batch.Keys) {
        if (-not $previous.ContainsKey($name)) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
        [Environment]::SetEnvironmentVariable($name, $batch[$name], 'Process')
    }
    Push-Location (Join-Path $PSScriptRoot '../babychatboot_backend/parenting')
    try { & ./mvnw.cmd -q spring-boot:run } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outputPath)) {
        throw 'Batch did not complete. Inspect the report and registered versions before retrying; completed items may remain.'
    }
    'Batch completed. The one-shot backend has stopped; inspect the output report.'
} finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
