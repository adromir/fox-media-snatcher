@echo off
setlocal EnableDelayedExpansion

echo ======================================================
echo    Fox Media Snatcher - FFmpeg Companion Installer
echo ======================================================
echo.

:: Get current directory with trailing backslash
set "SCRIPT_DIR=%~dp0"
set "JSON_PATH=%SCRIPT_DIR%foxmediasnatcher_host.json"
set "BAT_PATH=%SCRIPT_DIR%foxmediasnatcher_host.bat"

:: Escape backslashes for JSON
set "ESCAPED_BAT_PATH=%BAT_PATH:\=\\%"

echo [1/3] Generating host manifest with absolute path...
(
  echo {
  echo   "name": "foxmediasnatcher_host",
  echo   "description": "Fox Media Snatcher Native Messaging Companion Host for FFmpeg",
  echo   "path": "!ESCAPED_BAT_PATH!",
  echo   "type": "stdio",
  echo   "allowed_extensions": [
  echo     "fox-media-snatcher@adromir.local"
  echo   ]
  echo }
) > "%JSON_PATH%"

echo [2/3] Registering in Windows Registry for Mozilla Firefox...
REG ADD "HKCU\Software\Mozilla\NativeMessagingHosts\foxmediasnatcher_host" /ve /t REG_SZ /d "%JSON_PATH%" /f >nul
if %ERRORLEVEL% equ 0 (
    echo       Registry key added successfully.
) else (
    echo       [ERROR] Failed to write registry key.
    pause
    exit /b 1
)

echo [3/3] Verifying dependencies...
python --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "delims=" %%v in ('python --version') do echo       Python: %%v
) else (
    echo       [WARNING] Python was not found in PATH!
)

ffmpeg -version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo       FFmpeg: Detected and ready!
) else (
    echo       [WARNING] FFmpeg was not found in PATH. You can install it or specify its path in settings.
)

echo.
echo ======================================================
echo   Fox Media Snatcher Companion successfully installed!
echo ======================================================
echo.
pause
