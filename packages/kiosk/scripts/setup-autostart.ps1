# =============================================================================
# HTMLSignage Kiosk — Windows Auto-Start Setup
#
# Dieses Script konfiguriert ein Windows-System als dedizierten Signage-Kiosk:
#   - Erstellt eine Startup-Verknuepfung
#   - Aktiviert Focus Assist (Nicht stoeren)
#   - Deaktiviert Bildschirmschoner
#   - Deaktiviert Windows Update Neustart-Benachrichtigungen
#
# Verwendung (PowerShell als Administrator):
#   .\setup-autostart.ps1 [-AppPath "C:\pfad\zur\app"] [-Uninstall]
# =============================================================================

param(
    [string]$AppPath = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$ShortcutName = "HTMLSignage Kiosk.lnk"
$StartupFolder = [System.IO.Path]::Combine(
    [Environment]::GetFolderPath("Startup"),
    $ShortcutName
)

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------

function Write-Info  { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# Deinstallation
# ---------------------------------------------------------------------------

if ($Uninstall) {
    Write-Info "Deinstalliere HTMLSignage Kiosk Auto-Start..."

    if (Test-Path $StartupFolder) {
        Remove-Item $StartupFolder -Force
        Write-Info "Startup-Verknuepfung entfernt."
    } else {
        Write-Warn "Keine Startup-Verknuepfung gefunden."
    }

    Write-Info "Deinstallation abgeschlossen."
    exit 0
}

# ---------------------------------------------------------------------------
# Pruefungen
# ---------------------------------------------------------------------------

$PackageJson = Join-Path $AppPath "package.json"
if (-not (Test-Path $PackageJson)) {
    Write-Err "package.json nicht gefunden in $AppPath"
    Write-Err "Bitte -AppPath angeben."
    exit 1
}

# Electron-Pfad bestimmen
$ElectronBin = Join-Path $AppPath "node_modules\.bin\electron.cmd"
if (-not (Test-Path $ElectronBin)) {
    $ElectronBin = (Get-Command electron -ErrorAction SilentlyContinue).Source
    if (-not $ElectronBin) {
        Write-Err "Electron nicht gefunden. Bitte 'pnpm install' im kiosk-Verzeichnis ausfuehren."
        exit 1
    }
}

Write-Info "Electron: $ElectronBin"
Write-Info "App-Pfad: $AppPath"

# ---------------------------------------------------------------------------
# 1. Startup-Verknuepfung erstellen
# ---------------------------------------------------------------------------

Write-Info "Erstelle Startup-Verknuepfung..."

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($StartupFolder)
$Shortcut.TargetPath = $ElectronBin
$Shortcut.Arguments = "`"$AppPath`""
$Shortcut.WorkingDirectory = $AppPath
$Shortcut.Description = "HTMLSignage Display im Kiosk-Modus"
$Shortcut.WindowStyle = 7  # Minimized (Electron oeffnet sich selbst im Vollbild)
$Shortcut.Save()

Write-Info "Startup-Verknuepfung erstellt: $StartupFolder"

# ---------------------------------------------------------------------------
# 2. Focus Assist / Nicht stoeren aktivieren
# ---------------------------------------------------------------------------

Write-Info "Aktiviere Focus Assist (Nicht stoeren)..."

try {
    # Priority Only mode (2) — unterdrueckt die meisten Benachrichtigungen
    $RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
    if (-not (Test-Path $RegPath)) {
        New-Item -Path $RegPath -Force | Out-Null
    }
    Set-ItemProperty -Path $RegPath -Name "NOC_GLOBAL_SETTING_ALLOW_TOASTS_ABOVE_LOCK" -Value 0 -Type DWord
    Set-ItemProperty -Path $RegPath -Name "NOC_GLOBAL_SETTING_ALLOW_CRITICAL_TOASTS_ABOVE_LOCK" -Value 0 -Type DWord
    Write-Info "Benachrichtigungen auf dem Sperrbildschirm deaktiviert."
} catch {
    Write-Warn "Focus Assist konnte nicht konfiguriert werden: $_"
}

# ---------------------------------------------------------------------------
# 3. Bildschirmschoner deaktivieren
# ---------------------------------------------------------------------------

Write-Info "Deaktiviere Bildschirmschoner..."

try {
    $RegPath = "HKCU:\Control Panel\Desktop"
    Set-ItemProperty -Path $RegPath -Name "ScreenSaveActive" -Value "0"
    Set-ItemProperty -Path $RegPath -Name "ScreenSaverIsSecure" -Value "0"
    Set-ItemProperty -Path $RegPath -Name "ScreenSaveTimeOut" -Value "0"
    Write-Info "Bildschirmschoner deaktiviert."
} catch {
    Write-Warn "Bildschirmschoner konnte nicht deaktiviert werden: $_"
}

# ---------------------------------------------------------------------------
# 4. Energieoptionen: Display nie ausschalten
# ---------------------------------------------------------------------------

Write-Info "Konfiguriere Energieoptionen..."

try {
    # Bildschirm nie ausschalten (AC und DC)
    powercfg /change monitor-timeout-ac 0
    powercfg /change monitor-timeout-dc 0
    # Nie in Standy
    powercfg /change standby-timeout-ac 0
    powercfg /change standby-timeout-dc 0
    Write-Info "Display und Standby-Timeout deaktiviert."
} catch {
    Write-Warn "Energieoptionen konnten nicht konfiguriert werden: $_"
}

# ---------------------------------------------------------------------------
# 5. Windows Update Neustart-Benachrichtigungen unterdruecken
# ---------------------------------------------------------------------------

Write-Info "Unterdruecke Windows Update Neustart-Hinweise..."

try {
    $RegPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"
    if (-not (Test-Path $RegPath)) {
        New-Item -Path $RegPath -Force | Out-Null
    }
    # NoAutoRebootWithLoggedOnUsers = 1 verhindert automatische Neustarts
    Set-ItemProperty -Path $RegPath -Name "NoAutoRebootWithLoggedOnUsers" -Value 1 -Type DWord
    Write-Info "Automatische Update-Neustarts unterdrueckt."
} catch {
    Write-Warn "Windows Update Einstellungen konnten nicht gesetzt werden (Admin-Rechte erforderlich): $_"
}

# ---------------------------------------------------------------------------
# Zusammenfassung
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Info "HTMLSignage Kiosk Setup abgeschlossen!"
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Startup:   $StartupFolder"
Write-Host "  Entfernen: .\setup-autostart.ps1 -Uninstall"
Write-Host ""
Write-Info "Der Kiosk startet automatisch beim naechsten Windows-Login."
Write-Host ""
