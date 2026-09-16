param(
    [string]$Repository = "Federpelli/JAVA_LINGUO"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$privateKeyPath = Join-Path $projectRoot ".tauri-secrets\java-linguo.key"

if (-not (Test-Path -LiteralPath $privateKeyPath -PathType Leaf)) {
    throw "Chiave privata assente. Generala con: npx tauri signer generate --write-keys .tauri-secrets/java-linguo.key"
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI non è installata. Installala da https://cli.github.com/ e poi riesegui questo script."
}

& gh auth status
if ($LASTEXITCODE -ne 0) {
    throw "Autenticazione GitHub CLI assente. Esegui: gh auth login"
}

Get-Content -LiteralPath $privateKeyPath -Raw | & gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $Repository
if ($LASTEXITCODE -ne 0) {
    throw "GitHub non ha accettato il secret TAURI_SIGNING_PRIVATE_KEY."
}

Write-Host "Secret updater configurato per $Repository. La chiave non è stata stampata né aggiunta a Git."
