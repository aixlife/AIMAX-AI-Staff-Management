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
; 앱(app.py _create_app_mutex)이 시작 시 만드는 뮤텍스와 같은 이름이어야 한다.
; 뮤텍스가 살아 있으면 설치기가 "실행 중" 을 감지해 종료 후 교체한다(부분 교체 방지).
AppMutex=AIMAXAgentAppMutex
; RestartManager 로 교체 대상 파일을 잡고 있는 프로세스를 강제 종료한다.
CloseApplications=force
; 재실행은 [Run] postinstall(런처) 가 담당하므로 RestartManager 의 자동 재시작은 끈다.
RestartApplications=no
; 설치 로그 자동 저장({tmp}\Setup Log*.txt). DeinitializeSetup 에서 사용자 로그 폴더로 복사.
SetupLogging=yes

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
; restartreplace: 파일이 여전히 잠겨 있으면 오류로 중단(부분 교체)하는 대신 재부팅 시
; 교체를 예약한다. (비관리자에서 예약이 거부되는 환경이 있을 수 있으나, 그 경우에도
; 앱의 시작 시 매니페스트 자기검사가 혼합 상태 실행을 차단한다.)
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs restartreplace

[InstallDelete]
Type: files; Name: "{userstartup}\{#AppDisplayName}.lnk"
Type: files; Name: "{commonstartup}\{#AppDisplayName}.lnk"
; ── 이전 세대 페이로드 잔재 정리 ──
; PyInstaller onedir 은 세대마다 파일 구성이 완전히 달라져, 덮어쓰기만 하면 이전 세대의
; 런타임/패키지 파일이 누적된다(실측: 설치 폴더 3,512개 중 1,758개가 구버전 잔재 —
; 옛 python DLL/pyd, 옛 패키지 트리 전체). 이것이 "혼합 상태" 실행의 주범이므로
; 새 파일을 복사하기 전에 페이로드가 관리하는 _internal 트리를 통째로 비운다.
; 사용자 데이터는 %APPDATA%\NaverBlogAuto 에 있어 {app} 하위 정리는 안전하며,
; unins000.* (언인스톨러)는 {app} 루트의 비코드 파일이라 아래 규칙에 걸리지 않는다.
Type: filesandordirs; Name: "{app}\_internal"
; 구세대 페이로드가 설치 폴더 루트에 남긴 oracle\ 잔재(실측: orphan 12개 파일).
; 새 페이로드 루트에는 oracle 이 없으므로 통째로 정리해도 안전하다.
Type: filesandordirs; Name: "{app}\oracle"
; 옛 레이아웃(PyInstaller 5 이하)이 {app} 루트에 남긴 코드 파일도 정리한다.
; 새 페이로드는 루트에 exe/txt 만 두므로(코드 파일은 전부 _internal) 안전하다.
Type: files; Name: "{app}\*.dll"
Type: files; Name: "{app}\*.pyd"
Type: files; Name: "{app}\*.pyc"
Type: files; Name: "{app}\*.py"
Type: files; Name: "{app}\base_library.zip"

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

procedure KillAllTargetProcesses;
begin
  KillProcessByName('{#LauncherExeName}');
  KillProcessByName('{#AppExeName}');
  KillProcessByName('AIMAX-EngageWrite.exe');
  KillProcessByName('AIMAX-Find.exe');
end;

function AnyTargetProcessRunning: Boolean;
var
  ResultCode: Integer;
begin
  // tasklist 출력에서 대상 프로세스 이름을 찾는다. findstr 는 하나라도 일치하면 0 을
  // 반환하므로 ResultCode = 0 이 "아직 실행 중" 이다. (Exec 자체 실패 시 보수적으로 false)
  Result := False;
  if Exec(ExpandConstant('{cmd}'),
      '/C tasklist /NH | findstr /I /C:"{#AppExeName}" /C:"{#LauncherExeName}" /C:"AIMAX-EngageWrite.exe" /C:"AIMAX-Find.exe" >nul',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Result := (ResultCode = 0);
end;

// taskkill 후 고정 Sleep 대신 프로세스가 실제로 사라질 때까지 폴링 대기한다.
// (기존 Sleep(1500) 은 느린 PC/작업 중 크롬 구동 상태에서 부족해 부분 교체를 유발)
procedure WaitForTargetProcessesExit(TimeoutMS: Integer);
var
  WaitedMS: Integer;
begin
  WaitedMS := 0;
  while (WaitedMS < TimeoutMS) and AnyTargetProcessRunning do
  begin
    Sleep(500);
    WaitedMS := WaitedMS + 500;
  end;
end;

function InitializeSetup(): Boolean;
begin
  // Inno 는 이 함수가 True 를 반환한 "직후" AppMutex 를 검사한다. 정상 경로에선
  // 여기서 앱을 먼저 종료해 뮤텍스를 없애 두어 "AIMAX를 닫으십시오" 프롬프트 없이
  // (silent 설치 포함) 매끄럽게 진행되고, taskkill 이 실패한 비정상 경우에만
  // AppMutex 가 최후 방어선으로 설치(부분 교체)를 막는다.
  KillAllTargetProcesses;
  WaitForTargetProcessesExit(10000);
  Result := True;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  // 업데이트 시 옛 런처/코어를 모두 확실히 종료한 뒤 파일을 교체한다.
  // (옛 코어가 살아남아 "업데이트해도 연결 안 됨"/부분 교체를 만드는 문제 해소)
  KillAllTargetProcesses;
  WaitForTargetProcessesExit(10000);
  // 잔존 시 한 번 더(첫 종료 직후 재기동/좀비 대비) 강제 종료 후 짧게 재확인.
  if AnyTargetProcessRunning then
  begin
    KillAllTargetProcesses;
    WaitForTargetProcessesExit(3000);
  end;
  // 죽은 코어가 남긴 single-instance 락 잔재 정리(다음 실행을 막지 않게).
  DeleteFile(ExpandConstant('{userappdata}\NaverBlogAuto\aimax-local-agent.lock'));
  DeleteFile(ExpandConstant('{userappdata}\NaverBlogAuto\aimax-agent-launch.lock'));
  Result := '';
end;

procedure DeinitializeSetup();
var
  LogPath, TargetDir: String;
begin
  // SetupLogging=yes 로 남긴 설치 로그를 앱 로그 폴더에 복사해 문제 조사 시 수거 가능하게 한다.
  LogPath := ExpandConstant('{log}');
  if LogPath <> '' then
  begin
    TargetDir := ExpandConstant('{userappdata}\NaverBlogAuto\logs');
    if ForceDirectories(TargetDir) then
      CopyFile(LogPath, TargetDir + '\aimax-setup.log', False);
  end;
end;

[Run]
Filename: "{app}\{#LauncherExeName}"; Parameters: "aimax://agent/connect"; Description: "{#AppDisplayName} 실행기 연결 상태 열기"; StatusMsg: "{#AppDisplayName} 실행기를 여는 중입니다..."; Flags: nowait postinstall skipifsilent
