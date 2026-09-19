# Shared, testable switch logic. Keep old servers alive for in-flight requests and old assets.
function Get-IcareGatewayConfig {
    param([Parameter(Mandatory)][ValidatePattern('^[a-zA-Z0-9.-]+:[0-9]+$')][string]$Active,
          [Parameter(Mandatory)][ValidatePattern('^[a-zA-Z0-9.-]+:[0-9]+$')][string]$Previous,
          [Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]+$')][string]$Release)
    @'
worker_processes auto;
worker_shutdown_timeout 130s;
error_log /dev/stderr warn;
pid /var/run/nginx.pid;
events { worker_connections 1024; }
http {
    access_log off;
    client_max_body_size 4m;
    upstream current_app { server __ACTIVE__; }
    upstream previous_app { server __PREVIOUS__; }
    server {
        listen 8080;
        add_header X-Icare-Release __RELEASE__ always;
        location = /_deployment/health { return 200 '__RELEASE__'; }
        location / {
            proxy_pass http://current_app;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $http_host;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-For $remote_addr;
            proxy_read_timeout 125s;
            proxy_next_upstream off;
        }
        location /_next/static/ {
            proxy_pass http://current_app;
            proxy_intercept_errors on;
            error_page 404 = @previous_assets;
        }
        location @previous_assets { proxy_pass http://previous_app; }
    }
}
'@.Replace('__ACTIVE__',$Active).Replace('__PREVIOUS__',$Previous).Replace('__RELEASE__',$Release)
}

function Switch-IcareGateway {
    param([Parameter(Mandatory)][string]$ConfigPath, [Parameter(Mandatory)][string]$Candidate,
          [Parameter(Mandatory)][scriptblock]$Validate,
          [Parameter(Mandatory)][scriptblock]$Reload,
          [Parameter(Mandatory)][scriptblock]$Probe)
    if (!(Test-Path -LiteralPath $ConfigPath)) { throw 'Gateway must be initialized before a switch.' }
    $previous = [IO.File]::ReadAllText($ConfigPath)
    # Directory bind mount allows atomic file replacement to be visible inside the gateway.
    $pending = $ConfigPath + '.pending'
    [IO.File]::WriteAllText($pending,$Candidate)
    [IO.File]::Move($pending,$ConfigPath,$true)
    try {
        & $Validate
        & $Reload
        & $Probe
    } catch {
        $failure = $_
        [IO.File]::WriteAllText($pending,$previous)
        [IO.File]::Move($pending,$ConfigPath,$true)
        try { & $Validate; & $Reload }
        catch { throw 'Gateway rollback failed. The previous config is restored on disk; inspect the gateway before retrying.' }
        throw $failure
    }
}
