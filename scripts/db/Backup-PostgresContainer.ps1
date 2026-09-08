param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-zA-Z0-9_.-]+$')][string]$Container,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-zA-Z0-9_]+$')][string]$Database,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-zA-Z0-9_]+$')][string]$Username,
    [Parameter(Mandatory = $true)][string]$BackupDirectory
)

$ErrorActionPreference = 'Stop'
$destination = [IO.Path]::GetFullPath($BackupDirectory).TrimEnd('\', '/')
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\', '/')
if ((Test-Path -LiteralPath $destination) -or
    $destination.Equals($repository, [StringComparison]::OrdinalIgnoreCase) -or
    $destination.StartsWith($repository + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Use a new backup directory outside Git, on a separate healthy disk.'
}
$running = & docker inspect $Container --format '{{.State.Running}}'
if ($LASTEXITCODE -ne 0 -or $running -ne 'true') { throw 'Source container must already be running.' }
$temporaryDump = '/tmp/icare-backup-' + [Guid]::NewGuid().ToString('N') + '.dump'
& docker exec $Container pg_dump --format=custom --username=$Username --dbname=$Database --file=$temporaryDump
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed; no successful backup was recorded.' }
New-Item -ItemType Directory -Path $destination | Out-Null
$dump = Join-Path $destination 'database.dump'
# docker cp preserves binary bytes; do not pipe a custom dump through PowerShell text redirection.
& docker cp "${Container}:$temporaryDump" $dump
if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $dump).Length -eq 0) { throw 'Backup copy failed.' }
$sourceHashLine = & docker exec $Container sha256sum $temporaryDump
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify source archive checksum.' }
$copyHash = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash
if (($sourceHashLine -split '\s+')[0] -ne $copyHash) { throw 'Source and copied archive checksums differ.' }
& docker exec $Container pg_restore --list $temporaryDump | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Backup archive is unreadable.' }
$summary = [PSCustomObject]@{
    Container = $Container
    Database = $Database
    Dump = $dump
    SHA256 = $copyHash
    Bytes = (Get-Item -LiteralPath $dump).Length
    ArchiveListVerification = 'passed'
    RestoreVerification = 'pending'
    CreatedUtc = [DateTime]::UtcNow.ToString('o')
    ContainerTemporaryDump = $temporaryDump
}
$summary | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'backup-summary.json') -Encoding utf8
$summary | ConvertTo-Json
