param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-zA-Z0-9_.-]+$')][string]$Container,
    [Parameter(Mandatory = $true)][ValidatePattern('^icare_validation_[a-z0-9_]+$')][string]$Database,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-zA-Z0-9_]+$')][string]$Username,
    [Parameter(Mandatory = $true)][string]$DumpFile
)

$ErrorActionPreference = 'Stop'
$dump = (Resolve-Path -LiteralPath $DumpFile).Path
$purpose = & docker inspect $Container --format '{{index .Config.Labels "icare.purpose"}}'
if ($LASTEXITCODE -ne 0 -or $purpose -ne 'flyway-validation') {
    throw 'Restore is restricted to a container labeled icare.purpose=flyway-validation.'
}
$temporaryDump = '/tmp/icare-restore-' + [Guid]::NewGuid().ToString('N') + '.dump'
& docker cp $dump "${Container}:$temporaryDump"
if ($LASTEXITCODE -ne 0) { throw 'Cannot copy backup into validation container.' }
& docker exec $Container createdb --username=$Username $Database
if ($LASTEXITCODE -ne 0) { throw 'Cannot create a new validation database; existing databases are never overwritten.' }
& docker exec $Container pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --username=$Username --dbname=$Database $temporaryDump
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; keep the isolated database for inspection.' }
'Archive restored to a new validation database. Compare schema, rows, vectors and sequences before declaring verification complete.'
