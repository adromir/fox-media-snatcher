# Fox Media Snatcher - FFmpeg Native Companion PowerShell Installer
# Author: Adromir

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$JsonPath = Join-Path $ScriptDir "foxmediasnatcher_host.json"
$BatPath = Join-Path $ScriptDir "foxmediasnatcher_host.bat"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Fox Media Snatcher - FFmpeg Companion Installer" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Generating host manifest with absolute path..." -ForegroundColor Gray
$Manifest = @{
    name = "foxmediasnatcher_host"
    description = "Fox Media Snatcher Native Messaging Companion Host for FFmpeg"
    path = $BatPath
    type = "stdio"
    allowed_extensions = @("fox-media-snatcher@adromir.local")
}
$Manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $JsonPath -Encoding utf8

Write-Host "[2/3] Registering in Windows Registry for Mozilla Firefox..." -ForegroundColor Gray
$RegKey = "HKCU:\Software\Mozilla\NativeMessagingHosts\foxmediasnatcher_host"
if (-not (Test-Path "HKCU:\Software\Mozilla\NativeMessagingHosts")) {
    New-Item -Path "HKCU:\Software\Mozilla\NativeMessagingHosts" -Force | Out-Null
}
New-Item -Path $RegKey -Force | Out-Null
Set-ItemProperty -Path $RegKey -Name "(Default)" -Value $JsonPath | Out-Null
Write-Host "      Registry key added successfully." -ForegroundColor Green

Write-Host "[3/3] Verifying dependencies..." -ForegroundColor Gray
try {
    $pyVer = & python --version 2>&1
    Write-Host "      Python: $pyVer" -ForegroundColor Green
} catch {
    Write-Host "      [WARNING] Python not found in PATH." -ForegroundColor Yellow
}

try {
    $ffVer = & ffmpeg -version 2>&1 | Select-Object -First 1
    Write-Host "      FFmpeg: $ffVer" -ForegroundColor Green
} catch {
    Write-Host "      [WARNING] FFmpeg not found in PATH." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Fox Media Snatcher Companion successfully installed!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
