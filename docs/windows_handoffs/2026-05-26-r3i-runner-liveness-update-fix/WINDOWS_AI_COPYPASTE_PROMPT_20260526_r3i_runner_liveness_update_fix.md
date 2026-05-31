너는 AIMAX Windows 전용 Codex 개발자다. 이번 작업은 `R3-I Runner Liveness + Update Recognition Fix`다.

먼저 Syncthing 공유 폴더에서 아래 문서를 읽어라.

```text
WINDOWS_HANDOFF_20260526_r3i_runner_liveness_update_fix.md
WINDOWS_CONTINUOUS_TIKITAKA_PROTOCOL.md
```

공유 폴더:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3i-runner-liveness-update-fix
```

중요: 공유 폴더 안에서 빌드하지 말고, Windows 로컬 작업 폴더로 복사해서 작업해라. `.env`, 토큰, 쿠키, 브라우저 프로필, 고객 자격증명, raw private log는 절대 Syncthing에 넣지 마라.

## 문제

사용자가 최신 설치를 했다고 했지만 웹앱은 계속 예전 Windows 실행기 `v1.0.15`를 보고 있다. 실행기는 창이 뜨지 않고 먹통이라고 보고됐다.

추가로 사용자 스크린샷에서 설치 프로그램이 아래 오류로 멈춘 것이 확인됐다.

```text
설치 - AIMAX 버전 1.0.22
C:\Users\black\AppData\Local\Programs\AIMAX\aimax-agent-launcher.exe
기존 파일을 교체하는 동안 오류 발생:
DeleteFile 실패; 코드 5.
액세스가 거부되었습니다.
```

즉 단순 기능 버그가 아니라 다음 중 하나일 가능성이 높다.

- 예전 AIMAX 프로세스가 살아 있음
- protocol handler가 예전 exe를 가리킴
- 바로가기가 예전 exe를 가리킴
- installer가 old runtime을 닫거나 교체하지 못함
- dead PID lock / stale request file 때문에 새 실행 요청이 옛 런타임 또는 죽은 런타임으로 빨려 들어감
- 설치 중 `aimax-agent-launcher.exe`가 살아있어서 Inno Setup이 파일 교체에 실패함

## 해야 할 일

1. `r3i_changed_files_mac_source.zip`의 Mac R3-I 로직을 참고한다.
   - secret-store write timeout
   - web-requested local settings save는 UI thread를 막지 않음
2. Windows 앱 버전을 `v1.0.24`로 맞춘다.
3. 설치 후 active heartbeat가 반드시 `v1.0.24`를 보고하도록 stale process / protocol / shortcut / lock / request 파일을 점검하고 고친다.
4. installer가 `aimax-agent-launcher.exe`를 교체하기 전 기존 launcher/runtime을 안전하게 닫거나 종료하도록 고친다. 설치 중 `DeleteFile 실패; 코드 5`가 다시 나오면 실패다.
5. 진단 payload에 sanitized 경로/버전 정보를 추가한다.
   - installed_exe_path
   - launcher_exe_path
   - protocol_command
   - shortcut_target
   - active_process_pid
   - active_process_exe_path
   - active_process_version
   - lock_status
   - request_file_status
   - installer_closed_processes
   - launcher_file_replace_ok
   - launcher_file_replace_error_code
6. no-paid smoke `scripts\smoke_runner_liveness_update_fix.py`를 추가하거나 동등 검증을 작성한다.
7. Windows 설치파일 `aimax-bundle-windows.exe`를 빌드한다.

## 검증 기준

반드시 Windows에서 직접 실행:

```text
python -m py_compile aimax_compliance.py split_version\aimax_compliance.py app.py split_version\app.py local_agent\single_instance.py
python scripts\smoke_runner_liveness_update_fix.py
```

그리고 frozen diagnostics:

```text
version == v1.0.24
system.runtime.frozen == true
ai_text_import_smoke.ok == true
browser_version_detection.ok == true
runner_liveness_update_smoke.ok == true
```

추가로 확인:

```text
installer에서 aimax-agent-launcher.exe DeleteFile code 5가 발생하지 않음
aimax://agent/connect -> v1.0.24 runtime
aimax://agent/open-settings -> v1.0.24 runtime
current=v1.0.24 -> update_required=false
old/dead PID lock -> recovered
stale request file -> ignored/refreshed
실제 설치 후 웹앱에서 v1.0.24로 인식됨
```

## 금지

- 유료 AI/OpenAI/Gemini/Claude/image call 금지
- Apify 금지
- Naver publish/schedule/edit/save 금지
- 고객 계정/고객 자격증명 사용 금지
- secrets/cookies/.env/browser profile/raw private logs 공유 금지

## 완료 시 공유 폴더에 반환

```text
WINDOWS_RESULT_20260526_r3i_runner_liveness_update_fix.md
aimax_r3i_v124_runner_liveness_update_fix_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260526_r3i_runner_liveness_update_fix.json
```

`NEXT_TRIGGER_20260526_r3i_runner_liveness_update_fix.json`은 handoff 문서의 JSON 구조 그대로 작성한다.

막히면 넓게 추측하지 말고 좁은 blocker만 보고해라.
