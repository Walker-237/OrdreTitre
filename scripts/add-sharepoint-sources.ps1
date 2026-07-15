# ─────────────────────────────────────────────────────────────────────────────
# Script : add-sharepoint-sources.ps1
# Génère les services Code App typés pour les 13 listes SharePoint d'Audiences.
#
# Prérequis :
#   1. Les 13 listes existent dans le site SharePoint (créées via les CSV).
#   2. Une connexion SharePoint a été créée dans le maker portal pour cet env.
#   3. Tu as le Connection ID (GUID visible dans l'URL de la connexion).
#
# Usage :
#   .\scripts\add-sharepoint-sources.ps1 -ConnectionId "00000000-0000-0000-0000-000000000000"
# ─────────────────────────────────────────────────────────────────────────────

param (
    [Parameter(Mandatory = $true)]
    [string]$ConnectionId,

    [string]$SiteUrl = "https://afrilandfirstbankcmr.sharepoint.com/sites/Audiences"
)

$pac = "$env:APPDATA\Code\User\globalStorage\microsoft-isvexptools.powerplatform-vscode\pac\tools\pac.exe"
$api = "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"

if (-not (Test-Path $pac)) {
    Write-Host "Erreur : pac.exe introuvable à $pac" -ForegroundColor Red
    exit 1
}

$lists = @(
    "Utilisateurs",
    "Juridictions",
    "Avocats",
    "Agents",
    "Dossiers",
    "Parties",
    "Pieces",
    "Audiences",
    "Deliberes",
    "Honoraires",
    "Jurisprudence",
    "Alertes",
    "JournalAudit"
)

Write-Host "Site       : $SiteUrl"
Write-Host "Connection : $ConnectionId"
Write-Host "Listes     : $($lists.Count)"
Write-Host ""

$success = 0
$failed = @()

foreach ($list in $lists) {
    Write-Host "→ $list ... " -NoNewline
    & $pac code add-data-source --apiId $api --connectionId $ConnectionId --dataset $SiteUrl --table $list 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK" -ForegroundColor Green
        $success++
    } else {
        Write-Host "ECHEC" -ForegroundColor Red
        $failed += $list
    }
}

Write-Host ""
Write-Host "─────────────────────────────"
Write-Host "Réussi : $success / $($lists.Count)" -ForegroundColor $(if ($failed.Count -eq 0) { 'Green' } else { 'Yellow' })
if ($failed.Count -gt 0) {
    Write-Host "Échecs : $($failed -join ', ')" -ForegroundColor Red
    Write-Host "  → Vérifie que les listes existent avec ces noms exacts dans SharePoint."
    Write-Host "  → Vérifie que le Connection ID est correct et que la connexion est active."
}
Write-Host ""
Write-Host "Si tout est vert : les services typés sont générés dans src/Models/ et src/Services/."
Write-Host "Étape suivante : remplir les mappers dans src/data/sources/sharepoint.ts (cf. SHAREPOINT.md §3)."
