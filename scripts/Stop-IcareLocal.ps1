param([ValidateSet('backend','frontend','all')][string]$Service='all',
      [string]$RunDirectory=(Join-Path $env:USERPROFILE '.icare/local-run'))
$ErrorActionPreference='Stop'
$launcher=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'Start-IcareLocal.ps1'))
$services=if($Service -eq 'all'){@('backend','frontend')}else{@($Service)}
foreach($name in $services) {
    $record=Join-Path $RunDirectory "$name.pid"
    if(!(Test-Path -LiteralPath $record)){continue}
    $rootId=[int](Get-Content -LiteralPath $record)
    $root=Get-CimInstance Win32_Process -Filter "ProcessId=$rootId"
    if(!$root){continue}
    if(!$root.CommandLine.Contains($launcher) -or $root.CommandLine -notmatch "-Service\s+$name(?:\s|$)") {
        throw "Recorded $name process does not match this repository's launcher; left untouched."
    }
    $owned=[Collections.Generic.List[int]]::new();$owned.Add($rootId)
    for($i=0;$i -lt $owned.Count;$i++) {
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$($owned[$i])" | ForEach-Object {$owned.Add([int]$_.ProcessId)}
    }
    for($i=$owned.Count-1;$i -ge 0;$i--) {Stop-Process -Id $owned[$i] -ErrorAction SilentlyContinue}
    "$name local process tree stopped. Docker dependencies remain running."
}
