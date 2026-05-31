# Windows Handoff: R3-I Runner Liveness + Update Recognition Fix

Date: 2026-05-26 KST

## Context

R3-H is live:

```text
macOS latest/min: v1.0.14
Windows latest/min: v1.0.23
```

Latest user error report after R3-G/R3-H line:

```text
Report: AIMAX-RPT-20260526065632-57438e24
Platform: Windows
Web app version: v1.0.15
Agent version seen by web: v1.0.15
Connected: false / disconnected
User note: 최신 버전으로 설치했는데 계속 이전 버전으로 인식됨. 실행기는 실행 시 창이 뜨지 않고 먹통.
Visible error: Windows 실행기 필수 업데이트. 현재 v1.0.15, 최신 v1.0.22 설치 필요.
```

Additional user screenshot:

```text
Installer title: 설치 - AIMAX 버전 1.0.22
Target file:
C:\Users\black\AppData\Local\Programs\AIMAX\aimax-agent-launcher.exe

Error:
기존 파일을 교체하는 동안 오류 발생:
DeleteFile 실패; 코드 5.
액세스가 거부되었습니다.

Choices shown:
- 재시도
- 이 파일 건너뛰기 (권장하지 않음)
- 설치 취소
```

Interpretation:

The installer is failing before clean replacement because `aimax-agent-launcher.exe` is locked or access-denied. The user likely clicked retry/skip/cancel after this point, so the machine can be left in a mixed state: old `v1.0.15` runtime still active, newer files partially installed, protocol handler/shortcut pointing to a launcher that was not replaced, and the web app still seeing the stale heartbeat.

## Goal

Build Windows `v1.0.24` that prevents the stale-runner/update-loop failure.

## Source

Use:

```text
r3i_changed_files_mac_source.zip
```

It includes the Mac-side R3-I logic:

- Keychain/secret-store write timeout
- Web-requested local settings save moved off the UI thread
- Version bump on Mac source to `v1.0.15`

On Windows, apply the same UI/liveness logic where relevant, but set Windows app version to:

```text
v1.0.24
```

## Required Windows Fix Areas

### 1. Stale Process Cleanup

Before or during install/start, verify that old AIMAX local-agent processes are not left running. The installer must close/kill the old launcher/runtime before copying over `aimax-agent-launcher.exe`.

Check and fix:

- old `AIMAX.exe`
- old native launcher process
- old `aimax-agent-launcher.exe` process
- split/legacy AIMAX executables if still registered
- stale single-instance lock owned by a dead PID
- old request files that keep routing `aimax://agent/connect` or `aimax://agent/open-settings` to a dead or old runtime
- Inno Setup `DeleteFile failed; code 5` on `aimax-agent-launcher.exe`

Expected behavior:

```text
After installing v1.0.24, the active heartbeat must report v1.0.24, not v1.0.15/v1.0.21/v1.0.22/v1.0.23.
The installer must not show DeleteFile code 5 for aimax-agent-launcher.exe.
```

### 2. Protocol Handler / Shortcut Path Verification

Verify `aimax://agent/connect` and `aimax://agent/open-settings` resolve to the installed v1.0.24 runtime.

Diagnostics should include sanitized:

```text
installed_exe_path
launcher_exe_path
protocol_command
start_menu_shortcut_target
desktop_shortcut_target if present
active_process_pid
active_process_exe_path
active_process_version
installer_closed_processes
launcher_file_replace_ok
launcher_file_replace_error_code
```

Do not include usernames, secrets, cookies, browser profiles, or raw private logs.

### 3. UI Hang Guard

Apply the Mac R3-I local settings fix:

- secret-store writes must have a timeout
- web-requested local settings save must not block the UI thread
- if secret-store write times out, fallback storage should preserve the entered values and the app should remain responsive

### 4. Better Report Diagnostics

If the app reports `update_required`, include enough sanitized detail for support to see why:

```text
reported_app_version
latest_version
min_version
runtime_frozen
active_exe_path
protocol_command
install_root
lock_status
request_file_status
```

## Verification Required

Run these in Windows environment directly:

```text
python -m py_compile aimax_compliance.py split_version\aimax_compliance.py app.py split_version\app.py local_agent\single_instance.py
```

Add and run a no-paid smoke:

```text
python scripts\smoke_runner_liveness_update_fix.py
```

The smoke must prove:

```text
installer pre-close can release aimax-agent-launcher.exe
launcher replacement succeeds without DeleteFile code 5
secret-store write timeout does not freeze settings save
dead PID lock is recovered
stale request files are ignored or refreshed
protocol/open-settings reaches the current v1.0.24 runtime
heartbeat/version payload reports v1.0.24
update_required clears for current=v1.0.24
```

Build package:

```text
aimax-bundle-windows.exe
```

Frozen diagnostics must pass:

```text
version == v1.0.24
system.runtime.frozen == true
ai_text_import_smoke.ok == true
browser_version_detection.ok == true
runner_liveness_update_smoke.ok == true
```

## Forbidden

- Do not run paid AI, OpenAI, Gemini, Claude, or image generation.
- Do not run Apify.
- Do not publish, schedule, edit, or save to Naver.
- Do not use customer credentials.
- Do not put secrets, cookies, `.env`, browser profiles, signed URLs, or raw private logs in Syncthing.
- Do not build inside the Syncthing folder. Copy files to a local Windows work folder first.

## Return Files

Return these to the same shared folder:

```text
WINDOWS_RESULT_20260526_r3i_runner_liveness_update_fix.md
aimax_r3i_v124_runner_liveness_update_fix_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260526_r3i_runner_liveness_update_fix.json
```

`NEXT_TRIGGER_20260526_r3i_runner_liveness_update_fix.json`:

```json
{
  "verdict": "pass",
  "phase": "r3i_runner_liveness_update_fix",
  "next_recommended_action": "mac_verify_windows_r3i_then_prepare_rollout_or_r3j",
  "requires_mac_action": true,
  "requires_windows_action": false,
  "safe_to_continue_without_user": true,
  "requires_user_approval": false,
  "versions": {
    "windows": "v1.0.24"
  },
  "artifacts": [
    "WINDOWS_RESULT_20260526_r3i_runner_liveness_update_fix.md",
    "aimax_r3i_v124_runner_liveness_update_fix_diag.json",
    "aimax-bundle-windows.exe"
  ],
  "forbidden_actions_confirmed": {
    "paid_ai": true,
    "apify": true,
    "naver_publish_or_schedule": true,
    "customer_credentials": true,
    "shared_secrets": true
  },
  "notes": "Windows R3-I no-paid runner liveness/update recognition verification and package build passed."
}
```

If blocked, return a narrow blocker report instead of guessing.
