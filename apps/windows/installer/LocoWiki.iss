; LocoWiki Windows installer (Inno Setup 6)
; Build with: powershell -NoProfile -ExecutionPolicy Bypass -File apps/windows/build-installer.ps1

#define MyAppName "LocoWiki"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "LocoWiki"
#define MyAppExeName "LocoWiki.exe"

[Setup]
AppId={{6E2B0F9A-6D0B-4B7E-9F3A-2F5C8B1D4A77}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://locowiki.com
AppSupportURL=https://github.com/LocoWiki/LocoWiki.github.io
DefaultDirName={autopf}\LocoWiki
DefaultGroupName=LocoWiki
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\..\..\artifacts
OutputBaseFilename=LocoWiki-Setup-{#MyAppVersion}
SetupIconFile=..\src\LocoWiki.Desktop\Assets\locoWiki.ico
VersionInfoVersion=0.1.0.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoProductName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\..\..\artifacts\windows-standalone\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\LocoWiki"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\LocoWiki"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,LocoWiki}"; Flags: nowait postinstall skipifsilent
