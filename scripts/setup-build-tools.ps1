# Installs the local build toolchain used by the Windows and Android clients.
#
# Everything is installed under %USERPROFILE%\.locowiki-toolchain so that no SDK
# or build artifact ever ends up inside the git working tree.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-build-tools.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-build-tools.ps1 -DotNet
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-build-tools.ps1 -Android
#
param(
    [switch]$DotNet,
    [switch]$Android,
    [string]$InstallRoot = (Join-Path $env:USERPROFILE ".locowiki-toolchain")
)

$ErrorActionPreference = "Stop"

if (-not $DotNet -and -not $Android) {
    $DotNet = $true
    $Android = $true
}

$dotnetSdkVersion = "8.0.413"
$gradleVersion = "8.11.1"
$cmdlineToolsUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-Directory([string]$Path) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

if ($DotNet) {
    $dotnetDir = Join-Path $InstallRoot "dotnet"

    if (Test-Path (Join-Path $dotnetDir "dotnet.exe")) {
        Write-Step ".NET SDK already installed: $dotnetDir"
    } else {
        Write-Step "Downloading .NET $dotnetSdkVersion SDK"
        $zip = Join-Path $env:TEMP "dotnet-sdk-$dotnetSdkVersion-win-x64.zip"
        Invoke-WebRequest `
            -Uri "https://builds.dotnet.microsoft.com/dotnet/Sdk/$dotnetSdkVersion/dotnet-sdk-$dotnetSdkVersion-win-x64.zip" `
            -OutFile $zip `
            -UseBasicParsing

        Ensure-Directory $dotnetDir
        Expand-Archive -Path $zip -DestinationPath $dotnetDir -Force
        Remove-Item $zip -Force
    }

    & (Join-Path $dotnetDir "dotnet.exe") --list-sdks
}

if ($Android) {
    $jdkDir = Join-Path $InstallRoot "jdk17"
    $sdkDir = Join-Path $InstallRoot "android-sdk"

    if (-not (Test-Path (Join-Path $jdkDir "bin\java.exe"))) {
        Write-Step "Downloading Temurin JDK 17"
        $zip = Join-Path $env:TEMP "temurin17.zip"
        Invoke-WebRequest `
            -Uri "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse" `
            -OutFile $zip `
            -UseBasicParsing

        $temp = Join-Path $env:TEMP "temurin17-extract"
        Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
        Expand-Archive -Path $zip -DestinationPath $temp -Force

        $inner = Get-ChildItem $temp -Directory | Select-Object -First 1
        if (-not $inner) {
            throw "Unexpected JDK archive layout."
        }

        if (Test-Path $jdkDir) {
            Remove-Item $jdkDir -Recurse -Force
        }
        Move-Item $inner.FullName $jdkDir

        Remove-Item $zip -Force
        Remove-Item $temp -Recurse -Force
    }

    $sdkManager = Join-Path $sdkDir "cmdline-tools\latest\bin\sdkmanager.bat"
    if (-not (Test-Path $sdkManager)) {
        Write-Step "Downloading Android command-line tools"
        $zip = Join-Path $env:TEMP "commandlinetools.zip"
        Invoke-WebRequest -Uri $cmdlineToolsUrl -OutFile $zip -UseBasicParsing

        $temp = Join-Path $env:TEMP "commandlinetools-extract"
        Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
        Expand-Archive -Path $zip -DestinationPath $temp -Force

        Ensure-Directory (Join-Path $sdkDir "cmdline-tools")
        if (Test-Path (Join-Path $sdkDir "cmdline-tools\latest")) {
            Remove-Item (Join-Path $sdkDir "cmdline-tools\latest") -Recurse -Force
        }
        Move-Item (Join-Path $temp "cmdline-tools") (Join-Path $sdkDir "cmdline-tools\latest")

        Remove-Item $zip -Force
        Remove-Item $temp -Recurse -Force
    }

    $env:JAVA_HOME = $jdkDir
    $env:ANDROID_HOME = $sdkDir
    $env:ANDROID_SDK_ROOT = $sdkDir

    Write-Step "Accepting Android SDK licenses"
    $answers = ("y`n" * 100)
    $answers | & $sdkManager --sdk_root="$sdkDir" --licenses | Out-Null

    Write-Step "Installing Android SDK packages (platform-tools / android-35 / build-tools 35.0.0)"
    & $sdkManager --sdk_root="$sdkDir" "platform-tools" "platforms;android-35" "build-tools;35.0.0"
    if ($LASTEXITCODE -ne 0) {
        throw "Android SDK package installation failed (exit $LASTEXITCODE)."
    }

    $gradleDir = Join-Path $InstallRoot "gradle-$gradleVersion"
    if (-not (Test-Path (Join-Path $gradleDir "bin\gradle.bat"))) {
        Write-Step "Downloading Gradle $gradleVersion"
        $zip = Join-Path $env:TEMP "gradle-$gradleVersion-bin.zip"
        Invoke-WebRequest `
            -Uri "https://services.gradle.org/distributions/gradle-$gradleVersion-bin.zip" `
            -OutFile $zip `
            -UseBasicParsing

        $temp = Join-Path $env:TEMP "gradle-extract"
        Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
        Expand-Archive -Path $zip -DestinationPath $temp -Force
        Move-Item (Join-Path $temp "gradle-$gradleVersion") $gradleDir

        Remove-Item $zip -Force
        Remove-Item $temp -Recurse -Force
    }

    & (Join-Path $jdkDir "bin\java.exe") -version
}

Write-Step "Done"
Write-Host "Toolchain directory: $InstallRoot"
Write-Host "Windows build: powershell -NoProfile -ExecutionPolicy Bypass -File apps/windows/build.ps1"
Write-Host "Android build: powershell -NoProfile -ExecutionPolicy Bypass -File apps/android/build.ps1"
