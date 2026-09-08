param([Parameter(Mandatory = $true)][string]$ScratchDirectory)

$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $ScratchDirectory) { throw 'Use a new scratch directory.' }
$scratch = [IO.Path]::GetFullPath($ScratchDirectory)
$source = Join-Path $scratch 'source'
New-Item -ItemType Directory -Path (Join-Path $source 'global') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $source 'PG_VERSION') -Value '16'
[IO.File]::WriteAllBytes((Join-Path $source 'global/pg_control'), [byte[]](0, 255, 13, 10, 128, 42))
$backupScript = Join-Path $PSScriptRoot 'Backup-OfflinePostgres.ps1'
$result = (& $backupScript -SourceDirectory $source -BackupDirectory (Join-Path $scratch 'backup')) | ConvertFrom-Json
if ($result.HashVerification -ne 'passed' -or $result.RestoreVerification -ne 'pending' -or $result.Files -ne 2) {
    throw 'Successful copy must report hash verification and leave restore verification pending.'
}
$copiedBytes = [IO.File]::ReadAllBytes((Join-Path $scratch 'backup/cluster/global/pg_control'))
if ([Convert]::ToBase64String($copiedBytes) -ne [Convert]::ToBase64String([byte[]](0, 255, 13, 10, 128, 42))) {
    throw 'Binary content was not preserved.'
}
function Assert-Rejected([string]$destination, [string]$expected) {
    $message = ''
    try { & $backupScript -SourceDirectory $source -BackupDirectory $destination | Out-Null }
    catch { $message = $_.Exception.Message }
    if ($message -notlike "*$expected*") { throw "Expected rejection: $expected; actual: $message" }
}
Assert-Rejected (Join-Path $scratch 'backup') 'new backup directory'
Assert-Rejected (Join-Path $PSScriptRoot 'must-not-create') 'outside the repository'
Set-Content -LiteralPath (Join-Path $source 'postmaster.pid') -Value 'synthetic test marker'
Assert-Rejected (Join-Path $scratch 'running-backup') 'stopped cluster'
if (Test-Path -LiteralPath (Join-Path $scratch 'running-backup')) { throw 'Rejected source created output.' }
'PASS: binary preservation, hash/restore status distinction, overwrite refusal, repository exclusion, running-cluster refusal.'
'Synthetic fixtures retained in the supplied scratch directory; no real database was used.'
