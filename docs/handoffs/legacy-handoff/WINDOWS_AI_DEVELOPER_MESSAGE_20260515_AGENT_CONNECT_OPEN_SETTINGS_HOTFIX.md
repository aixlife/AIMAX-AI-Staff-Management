# Windows AI Developer Message - 2026-05-15 Agent Connect / Open Settings Hotfix

Audience: Windows AI developer

## Situation

Recent AIMAX webapp error reports show a repeated Windows user problem:

1. Users press `실행기 연결`, but visually nothing seems to happen.
2. Users press `로컬 설정 열기`, but no usable settings window appears.
3. Some users then report that the app is "running in Task Manager but not visible".

This is not only a UX problem. Oracle production command logs show a real Windows Local Agent failure when handling `open_settings`.

## Production Evidence Snapshot

Source: Oracle `/home/ubuntu/aimax-reports/data` inspected on 2026-05-15 KST.

- Error reports total: 13
- Current `new` reports: 3
- All current `new` reports are Windows `v1.0.2`
- `open_settings` commands total: 334
- `open_settings` by status:
  - `done`: 52
  - `failed`: 280
  - `delivered`: 2
- Final failure category:
  - `tk_destroyed`: 254
  - `cancelled`: 23
  - `saved`: 50
  - `delivered_only`: 2
  - `tk.tcl missing / unusable`: 1

Most frequent server-side command log:

```text
로컬 보안 설정 창을 열 수 없습니다: can't invoke "tk" command: application has been destroyed
```

One packaging-related log:

```text
로컬 보안 설정 창을 열 수 없습니다: Can't find a usable tk.tcl ...
This probably means that tk wasn't installed properly.
```

See `aimax-windows-open-settings-evidence-20260515.json` for a sanitized evidence summary.

## User Reports to Explain

### Report A

- Product: bundle
- OS: Windows 11
- User text: "프로그램 실행기가 실행이 안된다는 말이었는데 다른 답변을 주시네요."
- At report time: agent was connected, but local Naver/API settings were missing.
- Later: same user successfully saved local settings several times.

Interpretation: The user complaint is about invisible/no-feedback agent startup and local settings confusion. It may not be a pure connection failure.

### Report B

- Product: yeri
- OS: Windows 10
- User text: "로컬 보안설정까지 웹에서 된상태인데 깔려있는 프로그램이 가동이 안됩니다."
- Current agent readiness: Naver account and API keys still missing.
- Recent `open_settings` commands repeatedly failed with `application has been destroyed`.

Interpretation: This is a direct Local Agent settings-window bug.

### Report C

- Product: bundle
- OS: Windows 11
- User text: "설정 열기 해도 api키 뜨는 창만 열리고 저장 눌러도 그 다음 반응이 없습니다."
- Current agent readiness: Naver account and Gemini key ready, `neighbor_messages` missing.

Interpretation: This is partly UX/copy. Hyunju 서로이웃 멘트 is a web 작업 설정 item, not in the local security settings window. Mac/Oracle side will adjust web copy, but Windows should still make `open_settings` reliable.

## Ownership

Windows developer owns:

- Windows Local Agent behavior
- `aimax://agent/connect` Windows protocol behavior
- Windows single-instance behavior
- Tk/Tcl availability in Windows installer
- Local settings window creation and focus behavior
- Windows EXE rebuild and smoke/manual verification

Mac/Oracle developer owns:

- Webapp copy and button feedback
- Oracle/web deployment
- Updating public messages for existing reports after fix

## Required Fixes

### 1. Make `open_settings` reliable in headless Local Agent

Current likely problem:

- `HeadlessAgentMixin._open_headless_settings_dialog()` creates a fresh `tk.Tk()` for each command.
- After a previous Tk root is destroyed, later commands on Windows often fail with:
  - `can't invoke "tk" command: application has been destroyed`

Required behavior:

- Repeated `open_settings` commands must always open a usable settings window or return a clear actionable failure.
- Do not leave the user with silent no-op behavior.
- Recommended implementation options:
  - Use one persistent hidden Tk root and create `Toplevel` dialogs for each settings request.
  - Or spawn a short-lived settings dialog helper process with a clean Tk lifecycle.
  - Avoid repeated `tk.Tk()` creation/destruction inside a long-running agent process if it reproduces this failure.

Verification:

- On Windows installed EXE, click webapp `로컬 설정 열기` 10 times:
  - close with X several times
  - save several times
  - cancel several times
- Expected:
  - no `application has been destroyed`
  - server command status becomes `done` on save, `failed/cancelled` on cancel with clear message
  - subsequent clicks still work

### 2. Make `실행기 연결` visibly succeed or fail

Current user symptom:

- User clicks `실행기 연결`, but nothing visible happens.
- Some users see agent as running in Task Manager, but no UI/window.

Required behavior:

- Windows `aimax://agent/connect` must launch or focus the Local Agent in a predictable way.
- Repeated clicks must not spawn conflicting agents.
- If agent is already running, the existing instance should continue polling and ideally surface/focus a small status/settings window or otherwise make the connection visible.
- If Windows blocks protocol or EXE launch, document the expected Windows/browser prompt and failure mode.

Verification:

- Fresh Windows install.
- Browser on production webapp.
- Click `실행기 연결` 5 times.
- Expected:
  - exactly one AIMAX agent process
  - `/api/agent/status` shows connected within 15 seconds
  - user sees either a first-run connection dialog, a status window, or a clear browser/Windows prompt
  - no duplicate Chrome/Selenium cleanup caused by repeated connect clicks

### 3. Verify Windows Tk/Tcl packaging

One production command failed with missing `tk.tcl`.

Check:

- PyInstaller spec / Inno installer includes Tcl/Tk runtime files.
- Installed path contains usable `_tk_data` / `_tcl_data` or equivalent.
- Non-ASCII install paths still work. Evidence path included Korean/star characters:
  - `E:\HP컴퓨터 정리\★지금여기★\★매출임시\marketing\ai예리\...`

Verification:

- Install under a normal ASCII path.
- Install under a Korean/non-ASCII path if possible.
- Run `open_settings` from webapp.
- Run any existing headless polling smoke.

### 4. Return better command status

If opening settings fails locally:

- Update `/api/agent/commands/update` with:
  - status `failed`
  - concise local error
  - ideally a short user-action hint

Example:

```text
로컬 설정 창을 열지 못했습니다. 실행기를 완전히 종료한 뒤 다시 실행하거나 최신 설치 파일로 업데이트해주세요. 원인: ...
```

## Files to Inspect

Use the source bundle included with this handoff:

- `aimax-windows-agent-connect-open-settings-source-20260515.zip`

Important files:

- `local_agent/runtime.py`
  - `HeadlessAgentMixin.run`
  - `_open_first_run_connection_dialog`
  - `_process_headless_queue`
  - `_handle_web_agent_command`
  - `_open_headless_settings_dialog`
- `local_agent/single_instance.py`
- `web_agent/client.py`
- `app.py`
- `split_version/app.py`
- `packaging/windows/aimax_installer.iss`

## Expected Completion Report

Write a completion report back to the shared folder with:

1. Root cause found.
2. Files changed.
3. Exact Windows build outputs and SHA256.
4. Whether `aimax://agent/connect` repeated-click test passed.
5. Whether `open_settings` repeated open/save/cancel test passed.
6. Whether non-ASCII install path was tested.
7. Smoke/manual test logs.
8. Any Mac/Oracle-side follow-up still needed.

## Delivery Target

Rebuild and return the three Windows installers unless the user chooses a unified-only release:

- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`

