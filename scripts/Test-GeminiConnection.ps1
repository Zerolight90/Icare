param([string]$EnvFile = (Join-Path $PSScriptRoot '../.env'))
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Read-IcareEnv.ps1')
$values = Read-IcareEnv -Path $EnvFile
if ([string]::IsNullOrWhiteSpace($values.GEMINI_API_KEY)) { throw 'GEMINI_API_KEY is not configured' }
$model = if ($values.GEMINI_CHAT_MODEL) { $values.GEMINI_CHAT_MODEL } else { 'gemini-3.5-flash-lite' }
if ($model -notmatch '^gemini-[a-z0-9.-]+$') { throw 'Invalid model identifier' }
$headers = @{ 'x-goog-api-key' = $values.GEMINI_API_KEY }
function Invoke-Probe([string]$ModelName, [string]$Operation, [hashtable]$Body) {
    try {
        Invoke-RestMethod -Method Post -Uri "https://generativelanguage.googleapis.com/v1beta/models/${ModelName}:$Operation" `
            -Headers $headers -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 30
    } catch {
        # Never print request headers, exception bodies or the key.
        $http = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'network' }
        throw "Gemini $Operation failed (HTTP $http). Check key, model access and Free tier quota in AI Studio. No retry or model fallback was attempted."
    }
}
$chat = Invoke-Probe $model 'generateContent' @{
    contents = @(@{ parts = @(@{ text = 'Reply with only OK. This is a synthetic connectivity test.' }) })
    generationConfig = @{ maxOutputTokens = 32; temperature = 0 }
}
if (!$chat.candidates[0].content.parts.text) { throw 'Chat returned no text' }
'Chat connection passed (synthetic prompt; response not printed).'
$embedding = Invoke-Probe 'gemini-embedding-001' 'embedContent' @{
    model = 'models/gemini-embedding-001'
    content = @{ parts = @(@{ text = 'Synthetic connectivity test.' }) }
    outputDimensionality = 3072
}
if ($embedding.embedding.values.Count -ne 3072) { throw 'Unexpected embedding dimension' }
'Embedding connection passed (3072 dimensions; no DB writes).'
