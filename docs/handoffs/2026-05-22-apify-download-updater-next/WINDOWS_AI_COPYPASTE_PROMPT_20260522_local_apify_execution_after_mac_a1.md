Read first:
`20_Deploy-To-Windows\2026-05-22-apify-download-updater-next\MAC_COMPLETION_20260522_apify_local_readiness_deployed.md`

Then read:
`20_Deploy-To-Windows\2026-05-22-apify-download-updater-next\SEQUENTIAL_PLAN_20260522_songi_web_first_hybrid.md`

Then read:
`20_Deploy-To-Windows\2026-05-22-apify-download-updater-next\WINDOWS_HANDOFF_20260522_apify_download_updater_next.md`

Important clarification:

Mac/Oracle A1 is complete, but actual local-token Apify execution is NOT complete yet.

Completed on Mac/Oracle:

- Oracle now preserves `readiness.ai_keys.apify`.
- `/api/research/integrations` now distinguishes:
  - `apify.configured`: server-side Apify execution readiness only;
  - `apify.server_configured`;
  - `apify.local_configured`;
  - `apify.agent_ready`;
  - `apify.local_execution_available: false`;
  - `apify.execution_mode`.
- Web UI can show `PC Apify 토큰 저장됨`.
- Paid Apify buttons remain gated because the local-agent execution path does not exist yet.

Product direction:

- Songi should be `web-first + local-agent optional/hybrid`.
- Blog Team needs a local agent because it automates Naver browser workflows.
- Songi should not become local-agent-required by default.
- The local-agent Apify path is for users who choose to keep paid-provider keys only on their own computer.
- If server/company-managed Apify execution is configured, Songi should be usable from the web without forcing the local agent.

Not completed yet:

- Songi cannot yet use a user's locally saved Apify token to run SNS collection.
- This is the optional local-agent A2 task, not the default requirement for every Songi user.

Cross-platform product requirement:

This is not a Windows-only feature. AIMAX employees must work reliably for users on both macOS and Windows.

Implement the local Apify execution architecture in a way that preserves platform parity:

- Shared/server behavior must be platform-neutral.
- Local-agent command contracts must work the same on macOS and Windows.
- Platform-specific code should be limited to packaging, secure storage adapters, browser/protocol registration, and installer/updater behavior.
- If you touch shared files such as `oracle/aimax-reports-api/server.js`, `oracle/aimax-reports-api/static/app.html`, `app.py`, `split_version/app.py`, or `local_agent/runtime.py`, check whether the change affects macOS as well as Windows.
- Do not introduce a Windows-only success path where macOS users still see the selected execution path as configured but cannot run the task.

Task for Windows developer:

Implement the optional local-agent Apify execution path so Songi can collect Instagram/TikTok SNS data using the Apify token stored on the user's computer, without uploading that local token to Oracle.

Required direction:

1. Keep user Apify tokens local.
   - Do not send the raw Apify token to Oracle.
   - Do not put it in heartbeat, diagnostics, logs, Shared-Bridge, browser state, or error reports.

2. Add/implement local-agent command or job types, for example:
   - `songi_apify_collect_item`
   - `songi_apify_collect_profile`
   - Keep the command payload/result schema platform-neutral so macOS and Windows agents can both implement it.

3. Server/web behavior should be:
   - If server token exists, existing server execution can keep working.
   - Do not force local-agent execution when server/company-managed Apify execution is configured.
   - If no server token but `apify.local_configured=true`, queue a local-agent Apify command after explicit paid confirmation.
   - Show Korean progress states such as:
     - `로컬 실행기가 SNS 수집을 시작했습니다.`
     - `Apify 실행 결과를 기다리는 중입니다.`
     - `SNS 수집 완료`
     - `SNS 수집 실패: 로컬 실행기 로그를 확인해주세요.`

4. Local agent behavior should be:
   - Read Apify token only from local secure settings.
   - Run Apify collection with the local token.
   - Return sanitized output only:
     - source text/status;
     - actor/run/dataset IDs if useful;
     - Apify console status URL if useful;
     - no token;
     - no signed media URL;
     - no raw private log.
   - On macOS and Windows, use each OS secure storage adapter consistently. If an OS cannot access secure storage, show a clear Korean setup/recovery state instead of pretending the employee is ready.

5. Preserve paid-operation safety:
   - Require explicit `confirm_paid=true`.
   - Do not auto-retry paid Apify runs after ambiguous failure.
   - Preserve run ID/status URL when a run starts and later fails.
   - Prefer resume/status polling over duplicate submission.

6. Add no-paid tests first:
   - Fake local Apify token save/load.
   - Fake heartbeat with `ai_keys.apify=ready`.
   - `/api/research/integrations` reports `server_configured=false`, `local_configured=true`, and `local_execution_available` only when the local command path is actually supported.
   - Mock Apify client or fake local command result; do not run a real Apify Actor.
   - Without `confirm_paid`, endpoint returns `402` and starts no command/Actor.
   - With `confirm_paid=true` and mocked local agent, command is queued and item/project state updates from sanitized result.
   - Run the same mocked contract test against macOS-compatible and Windows-compatible local-agent code paths where possible.

Safety boundaries:

- Do not inspect or print real Apify tokens.
- Do not run real Apify Actors.
- Do not run paid AI/API calls.
- Do not run real Naver publish/save/draft tests.
- Do not copy `.env`, cookies, browser profiles, session tokens, setup links, signed URLs, or raw private logs into Shared-Bridge.
- Do not claim the feature is complete until a no-paid mocked end-to-end test passes.

Return:

Write a completion or blocker report in:
`20_Deploy-To-Windows\2026-05-22-apify-download-updater-next`

Include:

- changed files;
- whether local-agent Apify execution is implemented or still blocked;
- whether implementation is platform-neutral or Windows-only;
- what Mac-side follow-up is required, if any;
- whether a Windows installer rebuild is required;
- whether Oracle/web files need another deployment;
- test commands and summarized outputs;
- remaining risks.
