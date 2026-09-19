$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'BlueGreen.ps1')
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$dir=Join-Path $repo 'babychatboot_backend/parenting/target/gateway-test'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$config=Join-Path $dir 'nginx.conf'
$blue=Get-IcareGatewayConfig -Active 'host.docker.internal:18081' -Previous 'host.docker.internal:18081' -Release 'blue'
$green=Get-IcareGatewayConfig -Active 'host.docker.internal:18082' -Previous 'host.docker.internal:18081' -Release 'green'
[IO.File]::WriteAllText($config,$blue)
$start=@{FilePath='node';ArgumentList=@((Join-Path $PSScriptRoot 'gateway-fixtures.mjs'));RedirectStandardOutput=(Join-Path $dir 'fixture.log');RedirectStandardError=(Join-Path $dir 'fixture.err');PassThru=$true}
if($IsWindows){$start.WindowStyle='Hidden'}
$process=Start-Process @start
$created=$false
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start(); $gatewayPort=$listener.LocalEndpoint.Port; $listener.Stop()
function DockerTest {
    $output=& docker @args 2>&1
    if($LASTEXITCODE){throw "Gateway test Docker call failed: $output"}
    return $output
}
function Expect([string]$path,[string]$body) {
    for($i=0;$i -lt 30;$i++) {
        try {$r=Invoke-WebRequest "http://127.0.0.1:$gatewayPort$path" -TimeoutSec 3;if($r.Content -ceq $body){return}} catch {}
        Start-Sleep -Milliseconds 100
    }
    throw "Unexpected gateway response for $path"
}
try {
    $networkArgs=if($IsWindows){@()}else{@('--add-host','host.docker.internal:host-gateway')}
    if((& docker ps -aq --filter name=^/icare-gateway-validation$)){throw 'Existing gateway test container must be inspected first.'}
    $created=$true
    DockerTest run -d --name icare-gateway-validation --label icare.purpose=gateway-validation @networkArgs -p "127.0.0.1:${gatewayPort}:8080" --mount "type=bind,source=$dir,target=/etc/nginx,readonly" nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236 | Out-Null
    Expect '/' 'blue'
    $http=[Net.Http.HttpClient]::new()
    $pending=$http.GetStringAsync("http://127.0.0.1:$gatewayPort/slow")
    for($i=0;$i -lt 30;$i++) {if((Invoke-WebRequest 'http://127.0.0.1:18081/started').Content -eq 'true'){break};Start-Sleep -Milliseconds 50}
    $validate={DockerTest exec icare-gateway-validation nginx -t | Out-Null}
    $reload={DockerTest exec icare-gateway-validation nginx -s reload | Out-Null}
    Switch-IcareGateway -ConfigPath $config -Candidate $green -Validate $validate -Reload $reload -Probe {Expect '/' 'green'}
    if($pending.GetAwaiter().GetResult() -cne 'blue'){throw 'In-flight old request interrupted'}
    Expect '/_next/static/old.js' 'blue'
    $failed=$false
    try {Switch-IcareGateway -ConfigPath $config -Candidate ($blue+"`ninvalid directive;") -Validate $validate -Reload $reload -Probe {throw 'must not run'}} catch {$failed=$true}
    if(!$failed){throw 'Invalid configuration accepted'}
    Expect '/' 'green'
    $failed=$false
    try {Switch-IcareGateway -ConfigPath $config -Candidate $blue -Validate $validate -Reload $reload -Probe {throw 'synthetic failed health check'}} catch {$failed=$true}
    if(!$failed){throw 'Failed probe accepted'}
    Expect '/' 'green'
    Switch-IcareGateway -ConfigPath $config -Candidate $blue -Validate $validate -Reload $reload -Probe {Expect '/' 'blue'}
    'Gateway integration passed: switch, in-flight request, old assets, invalid config rollback, failed probe rollback, explicit rollback.'
} catch {
    if($created){ & docker logs --tail 20 icare-gateway-validation }
    throw
} finally {
    if($created){DockerTest rm -f icare-gateway-validation | Out-Null}
    if($process -and !$process.HasExited){Stop-Process -Id $process.Id}
    if($http){$http.Dispose()}
}
