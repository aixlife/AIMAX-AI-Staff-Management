; AIMAX Windows installer template for Inno Setup.
;
; Example:
;   iscc packaging\windows\aimax_installer.iss ^
;     /DAppDisplayName="AIMAX" ^
;     /DAppId="kr.makefamily.aimax" ^
;     /DAppExeName="AIMAX.exe" ^
;     /DSourceDir="dist\AIMAX" ^
;     /DOutputDir="dist\upload" ^
;     /DOutputBaseFilename="aimax-bundle-windows"

#ifndef AppDisplayName
#define AppDisplayName "AIMAX"
#endif

#ifndef AppId
#define AppId "kr.makefamily.aimax"
#endif

#ifndef AppExeName
#define AppExeName "AIMAX.exe"
#endif

#ifndef LauncherExeName
#define LauncherExeName "aimax-agent-launcher.exe"
#endif

#ifndef SourceDir
#define SourceDir "dist\AIMAX"
#endif

#ifndef OutputDir
#define OutputDir "dist\upload"
#endif

#ifndef OutputBaseFilename
#define OutputBaseFilename "aimax-bundle-windows"
#endif

#ifndef AppVersion
#define AppVersion "1.0.35"
#endif

[Setup]
AppId={#AppId}
AppName={#AppDisplayName}
AppVersion={#AppVersion}
AppPublisher=AIMAX
DefaultDirName={localappdata}\Programs\{#AppDisplayName}
DefaultGroupName={#AppDisplayName}
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
Type: files; Name: "{userstartup}\{#AppDisplayName}.lnk"
Type: files; Name: "{commonstartup}\{#AppDisplayName}.lnk"

[Registry]
Root: HKCU; Subkey: "Software\Classes\aimax"; ValueType: string; ValueData: "URL:AIMAX Local Agent"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\aimax"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\aimax\DefaultIcon"; ValueType: string; ValueData: "{app}\{#AppExeName},0"
Root: HKCU; Subkey: "Software\Classes\aimax\shell\open\command"; ValueType: string; ValueData: """{app}\{#LauncherExeName}"" ""%1"""

[Icons]
Name: "{autoprograms}\{#AppDisplayName}"; Filename: "{app}\{#LauncherExeName}"; IconFilename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppDisplayName}"; Filename: "{app}\{#LauncherExeName}"; IconFilename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "바탕화면 바로가기 만들기"; GroupDescription: "추가 아이콘:"; Flags: unchecked

[Code]
procedure KillProcessByName(ProcessName: String);
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM ' + ProcessName, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  // 업데이트 시 옛 런처/코어를 모두 확실히 종료한 뒤 파일을 교체한다.
  // (옛 코어가 살아남아 "업데이트해도 연결 안 됨"을 만드는 문제 해소)
  KillProcessByName('{#LauncherExeName}');
  KillProcessByName('{#AppExeName}');
  KillProcessByName('AIMAX-EngageWrite.exe');
  KillProcessByName('AIMAX-Find.exe');
  Sleep(1500);
  // 한 번 더(첫 종료 직후 재기동/잔존 대비)
  KillProcessByName('{#AppExeName}');
  KillProcessByName('{#LauncherExeName}');
  // 죽은 코어가 남긴 single-instance 락 잔재 정리(다음 실행을 막지 않게).
  DeleteFile(ExpandConstant('{userappdata}\NaverBlogAuto\aimax-local-agent.lock'));
  DeleteFile(ExpandConstant('{userappdata}\NaverBlogAuto\aimax-agent-launch.lock'));
  Sleep(500);
  Result := '';
end;

[Run]
Filename: "{app}\{#LauncherExeName}"; Parameters: "aimax://agent/connect"; Description: "{#AppDisplayName} 실행기 연결 상태 열기"; StatusMsg: "{#AppDisplayName} 실행기를 여는 중입니다..."; Flags: nowait postinstall skipifsilent
