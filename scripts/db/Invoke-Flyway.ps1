param(
    [Parameter(Mandatory = $true)][ValidateSet('info', 'validate', 'migrate', 'baseline')][string]$Action,
    [Parameter(Mandatory = $true)][ValidateRange(1, 16000)][int]$VectorDimensions,
    [switch]$SchemaReviewed
)

$ErrorActionPreference = 'Stop'
foreach ($name in @('ICARE_DB_URL', 'ICARE_DB_USER', 'ICARE_DB_PASSWORD')) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw "Set $name explicitly; application-secret.yml is not used by this command."
    }
}
if ($Action -eq 'baseline' -and -not $SchemaReviewed) {
    throw 'Baseline requires a reviewed schema comparison and verified backup. Pass -SchemaReviewed after review.'
}
$backend = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../babychatboot_backend/parenting'))
Push-Location -LiteralPath $backend
try {
    & ./mvnw.cmd -B -Pdb-migration "-Dmigration.vector-dimensions=$VectorDimensions" "flyway:$Action"
    if ($LASTEXITCODE -ne 0) { throw "Flyway $Action failed with exit code $LASTEXITCODE." }
} finally {
    Pop-Location
}
