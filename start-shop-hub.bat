@echo off
setlocal enabledelayedexpansion

title Karaoke & PS5 Commerce Hub - Production Standalone Host

echo ================================================================
echo           Karaoke ^& PS5 Commerce Hub - Standalone Host
echo           100%% Offline Local Shop Server ^& Real-Time Hub
echo ================================================================
echo.

:: Set Production Environment Variables
set NODE_ENV=production
if "%PORT%"=="" set PORT=3000
if "%APP_DATA_DIR%"=="" set APP_DATA_DIR=%~dp0data

echo [1/3] Environment: Production Standalone
echo [2/3] Persistent Data: %APP_DATA_DIR%
echo [3/3] Local Port: %PORT%
echo.

:: Launch Default Browser after 2 seconds in background
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"

:: Priority 1: Launch native self-contained Windows executable
if exist "%~dp0KaraokePS5CommerceHub.exe" (
    echo [STATUS] Launching self-contained executable: KaraokePS5CommerceHub.exe...
    "%~dp0KaraokePS5CommerceHub.exe"
    goto :end
)

if exist "%~dp0dist\KaraokePS5CommerceHub.exe" (
    echo [STATUS] Launching self-contained executable: dist\KaraokePS5CommerceHub.exe...
    "%~dp0dist\KaraokePS5CommerceHub.exe"
    goto :end
)

:: Priority 2: Use bundled zero-install runtime in bin/
if exist "%~dp0bin\node.exe" (
    echo [STATUS] Launching via bundled standalone runtime (Zero-Install)...
    "%~dp0bin\node.exe" "%~dp0dist\server.cjs"
    goto :end
)

:: Priority 3: Fallback to system Node.js if present
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [STATUS] Launching via system Node.js runtime...
    node "%~dp0dist\server.cjs"
    goto :end
)

echo [ERROR] No standalone runtime or Node.js installation found.
echo Please run the packaged KaraokePS5CommerceHub.exe directly or keep bin\node.exe in place.
pause
exit /b 1

:end
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Server stopped with exit code %errorlevel%.
    pause
)
