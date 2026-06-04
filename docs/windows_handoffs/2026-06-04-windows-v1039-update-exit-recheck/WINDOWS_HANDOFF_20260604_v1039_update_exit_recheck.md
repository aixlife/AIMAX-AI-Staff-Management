# Windows Handoff: v1.0.39 Update/Agent Exit Recheck

Date: 2026-06-04 KST
Owner: Mac Codex
Target: Windows Codex / Windows AI developer
Priority: High, customer-facing recovery loop

## Purpose

Investigate a real customer who re-opened several AIMAX Yeri error reports and then submitted a new Windows report saying the update/runner exits immediately.

This looks like a Windows installed-runner update/connect failure, not a new paid Yeri generation failure.

## Confirmed Mac/Oracle Evidence

Production version API for Windows `current=v1.0.39`:

- latest: `v1.0.44`
- min: `v1.0.44`
- update_available: `true`
- update_required: `true`

Production Windows installer:

- path on Oracle: `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
- size: `35,673,438`
- SHA256: `6fda2ee6ae3f4f3961e2e5a4555b084717a91d8a8d0900e92a7a09d08e5af93a`
- modified: `2026-06-02 03:37:20 KST`

No recent paid/job records were created around the new report time. Treat this as update/connect/install investigation. Do not run a paid Yeri job.

## Report IDs To Inspect

Same masked buyer in Telegram: `d***@naver.com`, product `yeri`.

### Existing Reports Re-opened By User

These were not new reports. The user clicked `아직 안 돼요`, which changed them back to `reviewing` and sent `[AIMAX 오류 보고 재확인 요청]` Telegram alerts around `2026-06-04 01:03 KST`.

- `AIMAX-RPT-20260601145545-8b47e0df`
  - first stored: `2026-06-01T14:55:45.048Z`
  - app/agent: `v1.0.39`, Windows
  - context: `예리씨가 자꾸 오류가 납니다`
  - visible error: AI provider/API key unavailable guidance
  - user response: `still_failing` at `2026-06-03T16:03:29.733Z`
  - diagnostics: local state available, one stale request file, last_next_job had a running job id from 2026-06-01 but no active job in report snapshot

- `AIMAX-RPT-20260601074107-3760c7b0`
  - first stored: `2026-06-01T07:41:07.620Z`
  - app/agent: `v1.0.37`, Windows
  - context: `api가 저장만되고 활성화가 안되서 예리를 설정할수가 없음`
  - user response: `still_failing` at `2026-06-03T16:03:31.677Z`
  - diagnostics: `local_state.available=false`, error `No module named 'local_agent.state_repair'`

- `AIMAX-RPT-20260601030134-c79e257d`
  - first stored: `2026-06-01T03:01:34.555Z`
  - app/agent: `v1.0.35`, Windows
  - context: `aimax 업데이트가 안됩니다`
  - user response: `still_failing` at `2026-06-03T16:03:32.973Z`
  - diagnostics: `local_state.available=false`, error `No module named 'local_agent.state_repair'`

- `AIMAX-RPT-20260529074031-53cbc6d0`
  - first stored: `2026-05-29T07:40:31.835Z`
  - app/agent: `v1.0.35`, Windows
  - context: `로컬 설정 열기`
  - user response: `still_failing` twice, latest at `2026-06-03T16:03:34.827Z`
  - diagnostics: `local_state.available=false`, error `No module named 'local_agent.state_repair'`

### New Report After Re-open

- `AIMAX-RPT-20260603160447-1f8114f7`
  - stored: `2026-06-03T16:04:47.989Z` / `2026-06-04 01:04:47 KST`
  - app/agent: `v1.0.39`, Windows
  - context: `업데이트 파일이 자꾸 강제 종료가 되서 실행기 연결이 안됩니다`
  - visible error: `AIMIX 실행기가 바로 종료되었습니다. 웹앱에서 연결버튼을 다시 눌러보고, 계속되면 오류 보고를 보내주세요`
  - diagnostics:
    - `local_state.available=true`
    - `repair_available=true`
    - `stale_request_count=2`
    - request files:
      - `aimax-local-agent-request.json`, stale, age about `170370s`
      - `aimax-local-agent.request.json`, stale, age about `177488s`
    - polling last next job was empty at `2026-06-03T14:52:51.311Z`
    - no active job

## Windows Tasks

1. Read the newest relevant handoff docs first, especially this file.
2. Work from a local Windows work folder, not inside Syncthing.
3. Do not use customer credentials, Naver credentials, API keys, or paid AI calls.
4. Reproduce or verify the update/connect path:
   - Open production web as a real user with the approved test account/session.
   - Check that Windows `current=v1.0.39` is treated as required update to `v1.0.44`.
   - Download the production Windows installer through the real web UI.
   - Confirm downloaded installer size/SHA256 matches the Oracle evidence above when possible.
   - Run the installer/update and observe whether it exits immediately, is blocked by SmartScreen/security software, or leaves no visible window.
   - Start the installed AIMAX runner and click `실행기 연결`.
   - Verify the web UI sees `v1.0.44`, and no stale `v1.0.39` state remains.
5. Specifically inspect local state after launching:
   - `%LOCALAPPDATA%\AIMAX\aimax-local-agent-request.json`
   - `%LOCALAPPDATA%\AIMAX\aimax-local-agent.request.json`
   - `%LOCALAPPDATA%\AIMAX\aimax-local-agent.lock`
   - Whether stale request files are quarantined or keep causing immediate exit / no visible UI.
6. If the installer exits or the runner closes:
   - Capture the exact visible text, Windows Event Viewer/app log if available, process list, and whether security software quarantined the executable.
   - Inspect installed version and logs under the AIMAX local app/log folders.
   - Do not delete customer-like local state unless this is a controlled test environment.
7. Return a completion or blocker report to the shared folder with:
   - Windows account/test environment
   - browser
   - installer SHA/size
   - installed version before/after
   - screenshots or visible status text
   - whether stale request files existed
   - whether v1.0.44 connects
   - exact next fix if blocked

## Expected Outcome

We need to know whether this is:

- user still running old `v1.0.35-v1.0.39` despite required update,
- production installer/update flow visibly failing on Windows,
- stale request/lock state causing the runner to exit or never connect,
- security software/SmartScreen blocking the installer,
- or a separate regression in `v1.0.44`.

No paid content generation, no Naver publish/schedule, and no customer credentials are needed for this check.
