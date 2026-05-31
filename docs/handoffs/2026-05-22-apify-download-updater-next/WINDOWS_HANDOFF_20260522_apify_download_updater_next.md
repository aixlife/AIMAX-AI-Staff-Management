# Windows Handoff 20260522 - Apify Local Settings And Browserless Update Path

Date: 2026-05-22 KST
Project: AIMAX / NaverBlogAuto
Source issue to read first:
`20_Deploy-To-Windows\2026-05-22-apify-local-settings-runtime-mismatch\WINDOWS_AI_DEVELOPER_MESSAGE_20260522_apify_local_settings_mismatch.md`

## Goal

Resolve two related user-facing problems:

1. A user enters an Apify API Token in AIMAX local security settings, but Songi web still says Apify is missing.
2. Windows users sometimes see Chrome/Edge temporary installer downloads such as `확인되지 않음 547514.crdownload`, and updates can appear stuck or absent.

No customer data, API keys, cookies, `.env`, browser profiles, signed URLs, or raw private logs may be copied into Shared-Bridge. Do not run paid AI calls, Apify Actors, or real Naver publish/save tests.

## Phase A - Songi / Apify Product Decision

Decision: Songi should be `web-first + local-agent optional/hybrid`, not local-agent-required by default.

Reason:

- Blog Team needs the local agent because it controls a local/browser Naver workflow.
- Songi is a research/analysis employee, so the default user experience should work from the web/server when the required provider credentials are available there.
- Local-agent execution is still useful as a privacy/BYOK path when a user chooses to keep paid-provider keys only on their own computer.
- Uploading a user paid-provider token to Oracle requires explicit product/security approval, encrypted per-user secret storage, deletion UI, and extra breach-risk handling.
- Therefore, keep two explicit paths:
  - `web/server path`: web-first Songi execution using server/company-managed credentials or an explicitly approved encrypted server-side user secret.
  - `local-agent path`: optional execution using a token kept only on the user's Mac/Windows computer.

Cross-platform requirement:

- This is not a Windows-only employee feature. Songi must behave consistently for macOS and Windows users.
- Server/web contracts must be platform-neutral.
- Local-agent command names, payloads, result schema, paid-confirmation behavior, and sanitized error reporting must be the same on macOS and Windows.
- Platform-specific code should stay limited to secure storage adapters, packaging, protocol registration, and installer/updater behavior.
- Do not mark an employee as fully ready on one platform if the selected execution path is unavailable on that platform.

## Phase A1 - Immediate Hotfix

Implement the minimum safe patch so the web app stops losing the local Apify signal:

- In `oracle/aimax-reports-api/server.js`:
  - add `apify: "unknown"` to `defaultReadiness().ai_keys`;
  - preserve `apify: readinessStatus(ai.apify)` in `sanitizeReadiness().ai_keys`.
- Extend `/api/research/integrations` to expose separate Apify states:
  - `apify.server_configured`: current server-side `APIFY_API_TOKEN` status;
  - `apify.local_configured` or `apify.agent_ready`: connected local agent readiness reports `ai_keys.apify === "ready"`;
  - keep `apify.configured` compatible with the existing synchronous server execution path until local-agent execution is implemented.
- Update Songi UI copy:
  - If no server token but local Apify is ready, do not show only `Apify 키 필요`.
  - Show a clear state such as `Apify 토큰은 이 PC에 저장됨 · SNS 수집은 로컬 실행기 업데이트 필요`.
  - Do not enable a paid Apify button unless the execution path that will actually use the local token is ready.

## Phase A2 - Optional Local-Agent Apify Path

Implement local-agent Apify execution after A1 as the optional local-secret path:

- Add command/job types such as:
  - `songi_apify_collect_item`
  - `songi_apify_collect_profile`
- Keep command payload/result schema compatible with both macOS and Windows local agents.
- Server queues the command when:
  - user confirmed paid execution;
  - no server token is configured;
  - connected local agent reports Apify ready.
- If server/company-managed Apify execution is configured, do not force the local-agent path.
- Local agent runs Apify with the local token only.
- macOS and Windows must both use their own secure storage path for the Apify token and report a clear Korean setup/recovery state if secure storage cannot be accessed.
- Local agent returns sanitized collection results:
  - source text/status,
  - actor/run/dataset IDs or status URLs if available,
  - no token, no raw secret, no signed media URL.
- Server updates the Songi item/project from the returned result.
- Preserve idempotency/paid locks. Never automatically submit a second paid Apify run after an ambiguous failure.

## Phase B - Windows Download/Install Decision

Literal answer: no, Windows cannot install an update without the installer/package bytes arriving on the PC.

Product answer: for already-installed users, do not use the browser as the updater. Let the installed AIMAX local agent download and install the update in the background. This avoids Chrome/Edge `.crdownload` behavior entirely for update flows.

First install and update should be separate:

- First install:
  - Keep the current authenticated browser ticket download as fallback.
  - Longer-term options: Microsoft Store, MSIX/App Installer, winget, or a small signed bootstrapper.
- Already installed users:
  - Prefer `실행기로 업데이트 설치`.
  - Web app sends an `install_update` or `download_update` command to the connected local agent, or opens `aimax://agent/update`.
  - Local agent downloads to an AIMAX update cache, verifies, then launches installer/update with explicit user confirmation.

## Phase B1 - Updater Implementation Shape

Recommended flow:

1. Server exposes update manifest data:
   - latest version,
   - minimum version,
   - platform,
   - product,
   - filename,
   - size,
   - SHA-256,
   - release notes.
2. Web app update button behavior:
   - If local agent is connected and supports updater command: send `install_update`.
   - If not connected: try `aimax://agent/update`.
   - If no agent or unsupported version: fall back to browser ticket download.
3. Local agent:
   - requests a short-lived download ticket using its existing web session token, or receives a non-secret manifest and asks server for ticket itself;
   - downloads to a temp/cache path such as `%LOCALAPPDATA%\AIMAX\updates\...`;
   - writes a temporary suffix such as `.download`, not `.crdownload`;
   - reports progress/status to `/api/agent/commands/update`;
   - verifies size and SHA-256 before running anything;
   - renames atomically after verification;
   - launches the installer normally or with the installer-specific silent flag only after that flag is confirmed for the actual installer technology.
4. Failure handling:
   - hash mismatch deletes the temp file and reports `update_hash_mismatch`;
   - network failure offers retry/resume;
   - install cancellation reports `update_cancelled_by_user`;
   - unsupported command falls back to browser download with Korean explanation.

## Phase B2 - Distribution And Signing Notes

- Code signing is still important and should be prioritized.
- Do not promise that EV code signing removes SmartScreen. Current Microsoft guidance says EV no longer bypasses SmartScreen by itself.
- Microsoft Store distribution is the most reliable way to avoid SmartScreen download warnings for broad users.
- MSIX/App Installer can help packaging and updates, but the `ms-appinstaller:` protocol is disabled by default for many consumer scenarios, so do not depend on it as the only install path.

References:

- Microsoft SmartScreen reputation guidance: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- Microsoft Defender SmartScreen overview: https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/
- MSIX App Installer web install guidance: https://learn.microsoft.com/en-us/windows/msix/app-installer/installing-windows10-apps-web
- BITS transfer documentation: https://learn.microsoft.com/en-us/windows/win32/bits/background-intelligent-transfer-service-portal

## Required No-Paid Verification

Apify:

- Fake local settings save/load for Apify token; assert no secret is printed.
- Heartbeat with `readiness.ai_keys.apify="ready"` persists and appears in public agent readiness.
- `/api/research/integrations` distinguishes `server_configured=false` from `local_configured=true`.
- Server/web path remains available when `server_configured=true`, without requiring a local agent.
- Without `confirm_paid`, Apify execution still returns `402` and no Actor starts.
- With fake/mocked local-agent Apify command, verify state transitions without calling Apify.
- Run the mocked local-agent command contract against both macOS-compatible and Windows-compatible code paths where possible.

Updater:

- Use a local fake HTTP file and fake manifest for download tests.
- Verify progress updates, temp file behavior, SHA-256 success, SHA-256 mismatch cleanup, and cancel behavior.
- Verify browser is not opened for the connected-agent update path.
- Verify fallback browser download still works when the agent is disconnected or too old.
- Verify no real installer is executed in smoke tests unless explicitly approved.

## Return Expectations

Return a completion or blocker report to this Shared-Bridge folder containing:

- files changed;
- exact command/test output summary;
- whether Apify A1 is complete;
- whether local-agent Apify A2 is implemented or still pending;
- whether the implementation is platform-neutral or Windows-only;
- any Mac-side follow-up required;
- whether updater command path is implemented or only specified;
- screenshots or logs with secrets redacted;
- final recommendation for whether to rebuild Windows installer and whether Oracle/web deployment is required.
