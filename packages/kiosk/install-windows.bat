@echo off
setlocal enabledelayedexpansion
title HTMLSignage Kiosk - Installer
color 0A

echo.
echo  ================================================
echo     HTMLSignage Kiosk - Windows Installer
echo  ================================================
echo.

REM -- 1. Node.js pruefen --

where node >nul 2>&1
if !ERRORLEVEL! neq 0 (
    color 0C
    echo  [FEHLER] Node.js ist nicht installiert!
    echo.
    echo  Bitte Node.js installieren: https://nodejs.org
    echo  LTS-Version empfohlen, mindestens v20
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set "NODE_VERSION=%%i"
echo  [OK] Node.js gefunden: !NODE_VERSION!

REM -- 2. Server-URL abfragen --

echo.
set /p "SERVER_URL=  Server-URL eingeben (z.B. http://192.168.1.100:5173): "

if "!SERVER_URL!"=="" (
    echo  [FEHLER] Keine URL eingegeben!
    pause
    exit /b 1
)

REM http:// ergaenzen falls vergessen
echo !SERVER_URL! | findstr /i "^http" >nul 2>&1
if !ERRORLEVEL! neq 0 (
    set "SERVER_URL=http://!SERVER_URL!"
    echo  [INFO] http:// automatisch ergaenzt.
)

echo  [OK] Server: !SERVER_URL!

REM -- 3. Installationsverzeichnis --

set "INSTALL_DIR=%LOCALAPPDATA%\HTMLSignage-Kiosk"
echo.
echo  Installiere nach: !INSTALL_DIR!
echo.

if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!"
if not exist "!INSTALL_DIR!\src" mkdir "!INSTALL_DIR!\src"

REM -- 4. Dateien kopieren --

echo  [1/5] Kopiere Dateien...

set "SCRIPT_DIR=%~dp0"
copy /y "!SCRIPT_DIR!package.json" "!INSTALL_DIR!\package.json" >nul
copy /y "!SCRIPT_DIR!src\main.js" "!INSTALL_DIR!\src\main.js" >nul
copy /y "!SCRIPT_DIR!src\offline.html" "!INSTALL_DIR!\src\offline.html" >nul

REM -- 5. config.json erstellen --

echo  [2/5] Erstelle Konfiguration...

> "!INSTALL_DIR!\config.json" (
    echo {
    echo   "serverUrl": "!SERVER_URL!",
    echo   "kioskMode": false,
    echo   "hideCursor": false,
    echo   "devMode": true
    echo }
)

REM -- 6. Dependencies installieren --

echo  [3/5] Installiere Electron (kann 1-2 Minuten dauern)...
echo.

cd /d "!INSTALL_DIR!"

where pnpm >nul 2>&1
if !ERRORLEVEL! equ 0 (
    call pnpm install --prod=false
) else (
    call npm install
)

if !ERRORLEVEL! neq 0 (
    color 0C
    echo.
    echo  [FEHLER] Installation fehlgeschlagen!
    pause
    exit /b 1
)

echo.
echo  [OK] Electron installiert.

REM -- 7. Desktop-Verknuepfung erstellen --

echo  [4/5] Erstelle Desktop-Verknuepfung...

set "ELECTRON_EXE=!INSTALL_DIR!\node_modules\.bin\electron.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\HTMLSignage Kiosk.lnk'); $sc.TargetPath = '!ELECTRON_EXE!'; $sc.Arguments = '\"!INSTALL_DIR!\"'; $sc.WorkingDirectory = '!INSTALL_DIR!'; $sc.Description = 'HTMLSignage Kiosk'; $sc.Save()"

echo  [OK] Desktop-Verknuepfung erstellt.

REM -- 8. Autostart --

echo  [5/5] Autostart konfigurieren...
echo.
set /p "AUTOSTART=  Beim Windows-Start automatisch starten? (j/n): "

if /i "!AUTOSTART!"=="j" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut($env:APPDATA + '\Microsoft\Windows\Start Menu\Programs\Startup\HTMLSignage Kiosk.lnk'); $sc.TargetPath = '!ELECTRON_EXE!'; $sc.Arguments = '\"!INSTALL_DIR!\"'; $sc.WorkingDirectory = '!INSTALL_DIR!'; $sc.Description = 'HTMLSignage Kiosk'; $sc.Save()"
    echo  [OK] Autostart aktiviert.
)

REM -- Fertig --

echo.
color 0A
echo  ================================================
echo     Installation abgeschlossen!
echo  ================================================
echo.
echo  Installiert in:  !INSTALL_DIR!
echo  Server-URL:      !SERVER_URL!
echo  Desktop-Icon:    HTMLSignage Kiosk
echo.
echo  Die App startet im TEST-MODUS (Fenster schliessbar).
echo  Fuer echten Kiosk-Modus: config.json bearbeiten
echo  und kioskMode auf true setzen.
echo.
echo  Config: !INSTALL_DIR!\config.json
echo.

set /p "LAUNCH=  Jetzt starten? (j/n): "
if /i "!LAUNCH!"=="j" (
    echo.
    echo  Starte HTMLSignage Kiosk...
    s