@echo off
setlocal

echo ================================================================
echo    Setup Auto-Start on Windows Boot for Karaoke & PS5 Hub
echo ================================================================
echo.

set SCRIPT_PATH=%~dp0start-shop-hub.bat
set SHORTCUT_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\KaraokeShopHub.lnk

echo Target Launcher: %SCRIPT_PATH%
echo Startup Folder:  %SHORTCUT_PATH%
echo.

powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT_PATH%'); $Shortcut.TargetPath = '%SCRIPT_PATH%'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.WindowStyle = 1; $Shortcut.Description = 'Karaoke & PS5 Commerce Hub Production Server'; $Shortcut.Save()"

if %errorlevel% equ 0 (
    echo [SUCCESS] Auto-start shortcut created in Windows Startup directory.
    echo The shop hub server will automatically launch when this Windows PC turns on.
) else (
    echo [ERROR] Failed to create startup shortcut.
)

echo.
pause
