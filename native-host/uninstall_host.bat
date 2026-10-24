@echo off
setlocal
echo ======================================================
echo   Fox Media Snatcher - FFmpeg Companion Uninstaller
echo ======================================================
echo.

REG DELETE "HKCU\Software\Mozilla\NativeMessagingHosts\foxmediasnatcher_host" /f >nul 2>&1
REG DELETE "HKCU\Software\Mozilla\NativeMessagingHosts\mediagrab_host" /f >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Successfully removed Fox Media Snatcher Host from registry.
) else (
    echo Registry key was already removed or does not exist.
)

echo.
pause
