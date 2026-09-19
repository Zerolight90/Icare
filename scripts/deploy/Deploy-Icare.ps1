param(
    [Parameter(Mandatory)][string]$EnvFile,
    [ValidateSet('deploy','rollback')][string]$Action='deploy',
    [ValidatePattern('^[a-f0-9]{7,40}$')][string]$Release,
    [switch]$CheckOnly
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../Read-IcareEnv.ps1')
. (Join-Path $PSScriptRoot 'BlueGreen.ps1')
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$EnvFile=(Resolve-Path -LiteralPath $EnvFile).Path
$values=Read-IcareEnv $EnvFile
foreach($key in @('ICARE_DEPLOY_STATE_DIR','ICARE_FRONTEND_ORIGIN','ICARE_DB_USER','ICARE_DB_PASSWORD','ICARE_REDIS_PASSWORD','JWT_SECRET','ICARE_PROXY_SECRET','GEMINI_API_KEY','GEMINI_CHAT_MODEL','ICARE_UPLOAD_DIR')) {
    if([string]::IsNullOrWhiteSpace($values[$key])) {throw "Missing deployment setting: $key"}
}
$origin=[uri]$values.ICARE_FRONTEND_ORIGIN
if($origin.Scheme -ne 'https' -or !$origin.Host -or $origin.UserInfo -or $origin.AbsolutePath -ne '/' -or $origin.Query -or $origin.Fragment) {throw 'Deployment requires an exact HTTPS public origin.'}
$stateDir=[IO.Path]::GetFullPath($values.ICARE_DEPLOY_STATE_DIR)
if($stateDir.TrimEnd('\','/') -eq $repo -or $stateDir.StartsWith($repo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Deployment state must be outside the repository.'}
if($Action -eq 'deploy' -and !$Release) {throw 'Deploy requires a reviewed Git release.'}
if($CheckOnly) {'Deployment settings validated; no Docker or filesystem mutation.';return}
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$lock=$null; $previousEnv=@{}
$dockerExecutable=(Get-Command docker -CommandType Application).Source
function Docker {
    $output=& $dockerExecutable @args 2>&1
    if($LASTEXITCODE -ne 0) {throw 'Docker operation failed. Inspect local Docker state; command output was suppressed to protect credentials.'}
    return $output
}
function Wait-Ready([string]$slot) {
    $deadline=[DateTime]::UtcNow.AddMinutes(3)
    do {
        $backend=(Docker inspect "icare-$slot-backend" | ConvertFrom-Json)[0]
        $frontend=(Docker inspect "icare-$slot-frontend" | ConvertFrom-Json)[0]
        if($backend.State.Health.Status -eq 'healthy' -and $frontend.State.Health.Status -eq 'healthy') {return}
        if(!$backend.State.Running -or !$frontend.State.Running) {throw 'Candidate exited; active deployment stays unchanged.'}
        Start-Sleep -Seconds 2
    } while([DateTime]::UtcNow -lt $deadline)
    throw 'Candidate readiness timeout; active deployment stays unchanged.'
}
try {
    $lock=[IO.File]::Open((Join-Path $stateDir 'deploy.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    foreach($key in $values.Keys) {$previousEnv[$key]=[Environment]::GetEnvironmentVariable($key,'Process');[Environment]::SetEnvironmentVariable($key,$values[$key],'Process')}
    foreach($key in @('ICARE_SLOT','ICARE_RELEASE')) {if(!$previousEnv.ContainsKey($key)) {$previousEnv[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}}
    $statePath=Join-Path $stateDir 'state.json'
    $state=if(Test-Path -LiteralPath $statePath){Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json}else{$null}
    if($state -and ($state.active -notin @('blue','green') -or $state.release -notmatch '^[a-f0-9]{7,40}$')) {throw 'Invalid deployment state'}
    $port=if($values.ICARE_GATEWAY_PORT){[int]$values.ICARE_GATEWAY_PORT}else{18000}
    if($state) {
        $current=Invoke-WebRequest "http://127.0.0.1:$port/_deployment/health" -TimeoutSec 10
        if($current.Content.Trim() -cne $state.release) {throw 'Gateway/state mismatch; reconcile interrupted deployment before replacing a slot.'}
    }
    # Reviewed Flyway files AND actual applied checksums must match. Never migrate a real DB in this pipeline.
    $manifest=Get-Content (Join-Path $repo 'config/deployment-schema.json') -Raw | ConvertFrom-Json
    $files=@(Get-ChildItem (Join-Path $repo 'babychatboot_backend/parenting/src/main/resources/db/migration') -File)
    if($files.Count -ne $manifest.files.Count) {throw 'Schema review required before deployment.'}
    foreach($file in $files) {
        $entry=$manifest.files | Where-Object name -eq $file.Name
        # Normalize CRLF so Windows and CI checkouts have the same reviewed hash.
        $bytes=[Text.Encoding]::UTF8.GetBytes([IO.File]::ReadAllText($file.FullName).Replace("`r`n","`n"))
        $hash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes))
        if(!$entry -or $entry.sha256 -cne $hash) {throw 'Migration changed; separate DB approval and manifest review required.'}
    }
    $history=(Docker exec parenting-postgres psql -U $values.ICARE_DB_USER -d parenting_db -At -c "SELECT version || ':' || checksum || ':' || success FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank") -join "`n"
    if($history.Trim() -cne ($manifest.applied -join "`n")) {throw 'Actual DB schema differs from reviewed schema; pipeline will not migrate it.'}
    $network=if($values.ICARE_DB_NETWORK){$values.ICARE_DB_NETWORK}else{'icare-local-db_default'}
    Docker network inspect $network | Out-Null
    $slot=if($state -and $state.active -eq 'blue'){'green'}else{'blue'}
    if($Action -eq 'rollback') {
        if(!$state -or !$state.previous -or !$state.previousRelease) {throw 'No previous deployment available.'}
        $slot=$state.previous; $Release=$state.previousRelease
        if($slot -notin @('blue','green') -or $Release -notmatch '^[a-f0-9]{7,40}$') {throw 'Invalid rollback state'}
    } else {
        $head=(& git -C $repo rev-parse HEAD).Trim()
        if($LASTEXITCODE -ne 0 -or !$head.StartsWith($Release)) {throw 'Release must identify this exact checkout.'}
        if((& git -C $repo status --porcelain --untracked-files=no)) {throw 'Commit tracked changes before building a release.'}
        $env:ICARE_SLOT=$slot; $env:ICARE_RELEASE=$Release
        "Building candidate $slot ($Release); current servers remain running."
        Docker compose --project-directory $repo --env-file $EnvFile -p "icare-$slot" -f (Join-Path $repo 'compose.deploy.yml') build | Out-Null
        Docker compose --project-directory $repo --env-file $EnvFile -p "icare-$slot" -f (Join-Path $repo 'compose.deploy.yml') up -d --wait --wait-timeout 180 | Out-Null
    }
    Wait-Ready $slot
    "Candidate $slot is ready; checking release identity before gateway switch."
    foreach($service in @('backend','frontend')) {
        $info=(Docker inspect "icare-$slot-$service" | ConvertFrom-Json)[0]
        if($info.Config.Image -cne "icare-${service}:$Release") {throw 'Rollback/candidate image does not match recorded release.'}
    }
    $nginxDir=Join-Path $stateDir 'nginx'; New-Item -ItemType Directory -Path $nginxDir -Force | Out-Null
    $config=Join-Path $nginxDir 'nginx.conf'
    $old=if($state){$state.active}else{$slot}
    $candidate=Get-IcareGatewayConfig -Active "icare-$slot-frontend:3000" -Previous "icare-$old-frontend:3000" -Release $Release
    $next=@{active=$slot;release=$Release;previous=if($state){$state.active}else{$null};previousRelease=if($state){$state.release}else{$null}}
    $probe={
        $passed=$false
        for($attempt=0;$attempt -lt 10;$attempt++) {
            try {
                $r=Invoke-WebRequest "http://127.0.0.1:$port/healthz" -TimeoutSec 5
                if($r.StatusCode -eq 200 -and $r.Headers['X-Icare-Release'] -eq $Release) {
                    $api=Invoke-WebRequest "http://127.0.0.1:$port/api/users/profile" -TimeoutSec 5 -SkipHttpErrorCheck
                    if($api.StatusCode -eq 401) {$passed=$true;break}
                }
            } catch { }
            Start-Sleep -Milliseconds 500
        }
        if(!$passed) {throw 'Gateway release probe failed'}
        # A state write failure is part of switch failure and restores the old gateway.
        [IO.File]::WriteAllText($statePath+'.pending',($next | ConvertTo-Json))
        [IO.File]::Move($statePath+'.pending',$statePath,$true)
    }
    if(!$state) {
        if(Test-Path -LiteralPath $config) {throw 'Untracked gateway configuration exists; inspect and reconcile before initial deployment.'}
        [IO.File]::WriteAllText($config,$candidate)
        Docker compose --project-directory $repo --env-file $EnvFile -p icare-gateway -f (Join-Path $repo 'compose.gateway.yml') up -d | Out-Null
        & $probe
    } else {
        Switch-IcareGateway -ConfigPath $config -Candidate $candidate -Validate {Docker exec icare-gateway nginx -t | Out-Null} -Reload {Docker exec icare-gateway nginx -s reload | Out-Null} -Probe $probe
    }
    "Deployment switched to $slot ($Release). Previous servers retained for draining and rollback."
} finally {
    foreach($key in $previousEnv.Keys) {[Environment]::SetEnvironmentVariable($key,$previousEnv[$key],'Process')}
    if($lock){$lock.Dispose()}
}
