@echo off
setlocal

echo ================================================================
echo    Remove Auto-Start for Karaoke & PS5 Hub
echo ================================================================
echo.

set SHORTCUT_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\KaraokeShopHub.lnk

if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo [SUCCESS] Auto-start shortcut removed.
) else (
    echo [INFO] No auto-start shortcut was found in Startup folder.
)

echo.
pause
