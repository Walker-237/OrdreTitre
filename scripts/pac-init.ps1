<#
.SYNOPSIS
  Wrapper pour `pac code init` qui passe les arguments depuis power.config.json.

.DESCRIPTION
  `pac code init` exige le flag `--displayName`. Ce script lit la configuration
  existante (power.config.json à la racine) et compose la commande avec :
    - --displayName       depuis `appDisplayName`
    - --buildPath         depuis `buildPath`           (défaut: dist)
    - --fileEntryPoint    depuis `buildEntryPoint`     (défaut: index.html)
    - --appUrl            depuis `localAppUrl`         (défaut: http://localhost:3000)
    - --environment       depuis `environmentId`       (sinon org actif)
    - --region            depuis `region`              (défaut: prod)
    - --description       depuis `description`         (optionnel)
    - --logoPath          depuis `logoPath`            (optionnel, "Default" = ignoré)

  ⚠ N'écrase pas un projet déjà initialisé : appelle d'abord pac et le laisse
  refuser si power.config.json existe. Pour forcer une réinitialisation,
  supprimer (ou renommer) power.config.json au préalable.

.PARAMETER ConfigPath
  Chemin du power.config.json à lire (par défaut: .\power.config.json).

.EXAMPLE
  .\scripts\pac-init.ps1
  # Initialise le Code App à partir de power.config.json
#>

[CmdletBinding()]
param(
  [string] $ConfigPath = "power.config.json"
)

$pac = Join-Path $env:APPDATA "Code\User\globalStorage\microsoft-isvexptools.powerplatform-vscode\pac\tools\pac.exe"
if (-not (Test-Path $pac)) {
  Write-Error "pac.exe introuvable à $pac — installer l'extension VS Code Power Platform Tools."
  exit 1
}

if (-not (Test-Path $ConfigPath)) {
  Write-Error "power.config.json introuvable à $ConfigPath."
  exit 1
}

$cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json

if (-not $cfg.appDisplayName) {
  Write-Error "power.config.json ne contient pas 'appDisplayName' — argument requis."
  exit 1
}

$args = @(
  'code', 'init',
  '--displayName',    $cfg.appDisplayName,
  '--buildPath',      ($(if ($cfg.buildPath)       { $cfg.buildPath }       else { 'dist' })),
  '--fileEntryPoint', ($(if ($cfg.buildEntryPoint) { $cfg.buildEntryPoint } else { 'index.html' })),
  '--appUrl',         ($(if ($cfg.localAppUrl)     { $cfg.localAppUrl }     else { 'http://localhost:3000' })),
  '--region',         ($(if ($cfg.region)          { $cfg.region }          else { 'prod' }))
)
if ($cfg.environmentId) { $args += @('--environment', $cfg.environmentId) }
if ($cfg.description -and $cfg.description.Trim()) {
  $args += @('--description', $cfg.description.Trim())
}
if ($cfg.logoPath -and $cfg.logoPath -ne 'Default') {
  $args += @('--logoPath', $cfg.logoPath)
}

Write-Host "→ pac $($args -join ' ')" -ForegroundColor Cyan
& $pac @args
exit $LASTEXITCODE
