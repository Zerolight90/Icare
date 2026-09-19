# Deliberately small dotenv subset; no evaluation, expansion or printed secrets.
function Read-IcareEnv {
    param([Parameter(Mandatory = $true)][string]$Path)
    $values = @{}
    $lineNumber = 0
    foreach ($line in [IO.File]::ReadAllLines((Resolve-Path -LiteralPath $Path).Path)) {
        $lineNumber++
        $trimmed = $line.Trim()
        if (!$trimmed -or $trimmed.StartsWith('#')) { continue }
        if ($trimmed -notmatch '^([A-Z_][A-Z0-9_]*)=(.*)$') { throw "Invalid env syntax at line $lineNumber" }
        $name = $Matches[1]; $value = $Matches[2].Trim()
        if ($values.ContainsKey($name)) { throw "Duplicate env name at line $lineNumber" }
        if ($value.StartsWith("'")) {
            if ($value.Length -lt 2 -or !$value.EndsWith("'") -or $value.Substring(1, $value.Length - 2).Contains("'")) { throw "Use a single-line literal at line $lineNumber" }
            $value = $value.Substring(1, $value.Length - 2)
        } elseif ($value -match '[\s$#"'']') {
            throw "Use single quotes around special characters at line $lineNumber"
        }
        $values[$name] = $value
    }
    return $values
}

function Get-IcareFrontendEnv {
    param([hashtable]$Values)
    $selected = @{}
    foreach ($name in @('BACKEND_URL','ICARE_FRONTEND_ORIGIN','ICARE_PROXY_SECRET','ICARE_BACKEND_TRANSPORT',
            'CF_ACCESS_CLIENT_ID','CF_ACCESS_CLIENT_SECRET','NEXT_PUBLIC_KAKAO_MAP_KEY')) {
        if ($Values.ContainsKey($name)) { $selected[$name] = $Values[$name] }
    }
    return $selected
}
