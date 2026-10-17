# Build the Android client.
#
# Requirements: JDK 17 and Android SDK (platform 35, build-tools 35.0.0).
# scripts/setup-build-tools.ps1 installs both into %USERPROFILE%\.locowiki-toolchain.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File apps/android/build.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File apps/android/build.ps1 -Configuration Release
#   powershell -NoProfile -ExecutionPolicy Bypass -File apps/android/build.ps1 -Install
#
param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",
    [switch]$Install
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$toolchain = Join-Path $env:USERPROFILE ".locowiki-toolchain"
$androidSdk = Join-Path $toolchain "android-sdk"
$jdk = Join-Path $toolchain "jdk17"
$gradleBin = Join-Path $toolchain "gradle-8.11.1\bin\gradle.bat"

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk

if (-not (Test-Path (Join-Path $jdk "bin\java.exe"))) {
    throw "JDK 17 was not found. Run scripts/setup-build-tools.ps1 -Android first."
}

if (-not (Test-Path (Join-Path $androidSdk "platforms\android-35"))) {
    throw "Android SDK platform 35 was not found. Run scripts/setup-build-tools.ps1 -Android first."
}

Push-Location $PSScriptRoot
try {
    $task = "assemble$Configuration"

    if (Test-Path $gradleBin) {
        & $gradleBin $task --no-daemon
    } else {
        & (Join-Path $PSScriptRoot "gradlew.bat") $task --no-daemon
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Gradle $task failed (exit $LASTEXITCODE)."
    }

    $variant = $Configuration.ToLowerInvariant()
    if ($Configuration -eq "Debug") {
        $apkName = "app-debug.apk"
    } elseif (Test-Path (Join-Path $PSScriptRoot "app\build\outputs\apk\$variant\app-release.apk")) {
        $apkName = "app-release.apk"
    } else {
        $apkName = "app-release-unsigned.apk"
    }
    $apk = Join-Path $PSScriptRoot "app\build\outputs\apk\$variant\$apkName"

    if (-not (Test-Path $apk)) {
        throw "Build finished but $apk was not found."
    }

    $artifactDir = Join-Path $repoRoot "artifacts\android"
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
    $target = Join-Path $artifactDir "LocoWiki-0.1.0-$variant.apk"
    Copy-Item $apk $target -Force

    Write-Host ""
    Write-Host "Build complete: $target"

    if ($Install) {
        $adb = Join-Path $androidSdk "platform-tools\adb.exe"
        & $adb install -r $target
        if ($LASTEXITCODE -ne 0) {
            throw "adb install failed (exit $LASTEXITCODE). Connect a device with USB debugging enabled."
        }
        Write-Host "Installed on device."
    }
}
finally {
    Pop-Location
}
