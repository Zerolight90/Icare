param(
    [ValidateSet('signup', 'verify', 'context')][string]$Mode = 'verify',
    [string]$Container = 'icare-backend-validation'
)
$ErrorActionPreference = 'Stop'
$details = (& docker inspect $Container | ConvertFrom-Json)[0]
if ($LASTEXITCODE -ne 0 -or $details.Config.Labels.'icare.purpose' -ne 'private-backend-validation') {
    throw 'Only the labeled validation backend may be tested.'
}
$jdbc = $details.Config.Env | Where-Object { $_ -like 'ICARE_DB_URL=*' }
if ($jdbc -notmatch '^ICARE_DB_URL=jdbc:postgresql://icare-flyway-validation:5432/icare_validation_[a-z0-9_]+$') {
    throw 'The backend must use the isolated validation database.'
}
foreach ($network in $details.NetworkSettings.Networks.PSObject.Properties.Name) {
    $info = (& docker network inspect $network | ConvertFrom-Json)[0]
    if (!$info.Internal) { throw 'The validation backend must have no external network.' }
}
$source = (Resolve-Path -LiteralPath $PSScriptRoot).Path
& docker run --rm --network "container:$Container" --mount "type=bind,source=$source,target=/checks,readonly" `
    eclipse-temurin:17-jdk-jammy@sha256:400014962ad7224461f945bb1cc3d7d5a1927ce15b8245b72d9cedcda554cd2a `
    java /checks/PrivateBackendSmoke.java $Mode
if ($LASTEXITCODE -ne 0) { throw 'Offline backend HTTP verification failed.' }
