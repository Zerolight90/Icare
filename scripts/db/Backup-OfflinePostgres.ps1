param(
    [Parameter(Mandatory = $true)][string]$SourceDirectory,
    [Parameter(Mandatory = $true)][string]$BackupDirectory
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SourceDirectory).Path.TrimEnd('\', '/')
$destination = [IO.Path]::GetFullPath($BackupDirectory).TrimEnd('\', '/')
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\', '/')
if ((Test-Path -LiteralPath $destination) -or
    $destination.Equals($repository, [StringComparison]::OrdinalIgnoreCase) -or
    $destination.StartsWith($repository + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
    $destination.Equals($source, [StringComparison]::OrdinalIgnoreCase) -or
    $destination.StartsWith($source + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Use a new backup directory outside the repository and source cluster.'
}
if (-not (Test-Path -LiteralPath (Join-Path $source 'PG_VERSION')) -or
    -not (Test-Path -LiteralPath (Join-Path $source 'global/pg_control'))) {
    throw 'Source is not a PostgreSQL cluster directory.'
}
if (Test-Path -LiteralPath (Join-Path $source 'postmaster.pid')) {
    throw 'Offline backup requires a stopped cluster; postmaster.pid exists. Do not remove it automatically.'
}
$entries = @(Get-Item -LiteralPath $source -Force) + @(Get-ChildItem -LiteralPath $source -Recurse -Force)
if ($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {
    throw 'Links/tablespaces require an explicit backup plan; no copy was made.'
}
$files = @($entries | Where-Object { -not $_.PSIsContainer })
$manifest = @($files | ForEach-Object {
    [PSCustomObject]@{
        Path = $_.FullName.Substring($source.Length + 1)
        Length = $_.Length
        SHA256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
})
$cluster = Join-Path $destination 'cluster'
New-Item -ItemType Directory -Path $cluster | Out-Null
foreach ($entry in Get-ChildItem -LiteralPath $source -Force) {
    Copy-Item -LiteralPath $entry.FullName -Destination $cluster -Recurse -Force
}
foreach ($item in $manifest) {
    $original = Join-Path $source $item.Path
    $copy = Join-Path $cluster $item.Path
    if ((Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash -ne $item.SHA256 -or
        (Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash -ne $item.SHA256) {
        throw 'Source changed during backup or copy verification failed. Keep this backup marked incomplete.'
    }
}
$afterFiles = @(Get-ChildItem -LiteralPath $source -Recurse -Force -File)
if ($afterFiles.Count -ne $files.Count -or (Test-Path -LiteralPath (Join-Path $source 'postmaster.pid'))) {
    throw 'Cluster changed during backup; keep this backup marked incomplete.'
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding utf8
$summary = [PSCustomObject]@{
    Source = $source
    Backup = $destination
    PostgreSQLMajor = (Get-Content -LiteralPath (Join-Path $source 'PG_VERSION') -Raw).Trim()
    Files = $manifest.Count
    Bytes = ($manifest | Measure-Object Length -Sum).Sum
    HashVerification = 'passed'
    RestoreVerification = 'pending'
    CreatedUtc = [DateTime]::UtcNow.ToString('o')
}
$summary | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'backup-summary.json') -Encoding utf8
$summary | ConvertTo-Json
