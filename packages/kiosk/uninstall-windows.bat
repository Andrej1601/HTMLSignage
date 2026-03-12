@echo off
setlocal
title HTMLSignage Kiosk - Deinstallation
color 0E

echo.
echo  ================================================
echo     HTMLSignage Kiosk - Deinstallation
echo  ================================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\HTMLSignage-Kiosk"

REM Electron-Prozess beenden falls laufend
taskkill /f /im electron.exe >nul 2>&1

REM Desktop-Verknuepfung entfernen
if exist "%USERPROFILE%\Desktop\HTMLSignage Kiosk.lnk" (
    del "%USERPROFILE%\Desktop\HTMLSignage Kiosk.lnk"
    echo  [OK] Desktop-Verknuepfung entfernt.
)

REM Autostart-Verknuepfung entfernen
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\HTMLSignage Kiosk.lnk" (
    del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\HTMLSignage Kiosk.lnk"
    echo  [OK] Autostart-Verknuepfung entfernt.
)

REM Installationsordner entfernen
if exist "%INSTALL_DIR%" (
    echo  Entferne %INSTALL_DIR% ...
    rmdir /s /q "%INSTALL_DIR%"
    echo  [OK] Installationsordner entfernt.
) else (
    echo  Kein Installationsordner gefunden.
)

echo.
color 0A
echo  [OK] HTMLSignage Kiosk wurde deinstalliert.
echo.
endlocal
pause
