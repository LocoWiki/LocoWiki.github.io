# Build the Windows desktop client.
#
# Requirements: .NET 8 SDK (or the local toolchain installed by
# scripts/setup-build-tools.ps1) and the Microsoft Edge WebView2 Runtime.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File apps/windows/build.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File apps/windows/build.ps1 -SelfContained
#
param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release",
    [switch]$SelfContained
)

$ErrorActionPreference = "Stop"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
$env:DOTNET_NOLOGO = "1"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$project = Join-Path $PSScriptRoot "src\LocoWiki.Desktop\LocoWiki.Desktop.csproj"
$output = Join-Path $repoRoot "artifacts\windows"

$localDotnet = Join-Path $env:USERPROFILE ".locowiki-toolchain\dotnet\dotnet.exe"
$dotnet = if (Test-Path $localDotnet) { $localDotnet } else { (Get-Command dotnet -ErrorAction SilentlyContinue).Source }

if (-not $dotnet) {
    throw "dotnet was not found. Run scripts/setup-build-tools.ps1 -DotNet or install the .NET 8 SDK."
}

$sdkVersion = & $dotnet --version
if (-not $sdkVersion) {
    throw "The current dotnet has no SDK. Run scripts/setup-build-tools.ps1 -DotNet or install the .NET 8 SDK."
}

Write-Host "dotnet SDK: $sdkVersion"
Write-Host "Output:     $output"

$selfContainedValue = if ($SelfContained) { "true" } else { "false" }

& $dotnet publish $project `
    --configuration $Configuration `
    --runtime win-x64 `
    --self-contained $selfContainedValue `
    --output $output

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed (exit $LASTEXITCODE)."
}

$exe = Join-Path $output "LocoWiki.exe"
if (-not (Test-Path $exe)) {
    throw "Build finished but $exe was not found."
}

Write-Host ""
Write-Host "Build complete: $exe"
