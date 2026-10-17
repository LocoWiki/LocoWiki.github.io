# Build the Windows installer (Inno Setup 6).
#
# The installer packages the self-contained win-x64 publish output, so the
# target machine only needs the WebView2 Runtime.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File apps/windows/build-installer.ps1
#
param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$project = Join-Path $PSScriptRoot "src\LocoWiki.Desktop\LocoWiki.Desktop.csproj"
$publishDir = Join-Path $repoRoot "artifacts\windows-standalone"
$iss = Join-Path $PSScriptRoot "installer\LocoWiki.iss"

$localDotnet = Join-Path $env:USERPROFILE ".locowiki-toolchain\dotnet\dotnet.exe"
$dotnet = if (Test-Path $localDotnet) { $localDotnet } else { (Get-Command dotnet -ErrorAction SilentlyContinue).Source }

$isccCandidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)
$iscc = $isccCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $iscc) {
    throw "Inno Setup 6 ISCC.exe was not found. Install it with: winget install --id JRSoftware.InnoSetup -e"
}

Write-Host "Publishing self-contained build..."
& $dotnet publish $project `
    --configuration $Configuration `
    --runtime win-x64 `
    --self-contained true `
    --output $publishDir

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed (exit $LASTEXITCODE)."
}

Write-Host "Building installer..."
& $iscc $iss
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup failed (exit $LASTEXITCODE)."
}

$setup = Join-Path $repoRoot "artifacts\LocoWiki-Setup-0.1.0.exe"
if (-not (Test-Path $setup)) {
    throw "Installer was not produced: $setup"
}

Write-Host ""
Write-Host "Installer: $setup"
