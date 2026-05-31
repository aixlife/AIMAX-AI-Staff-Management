Read first:
`20_Deploy-To-Windows\2026-05-22-apify-local-settings-runtime-mismatch\WINDOWS_AI_DEVELOPER_MESSAGE_20260522_apify_local_settings_mismatch.md`

Then read:
`20_Deploy-To-Windows\2026-05-22-apify-download-updater-next\SEQUENTIAL_PLAN_20260522_songi_web_first_hybrid.md`

Then read:
`20_Deploy-To-Windows\2026-05-22-apify-download-updater-next\WINDOWS_HANDOFF_20260522_apify_download_updater_next.md`

Task:

1. Fix the Apify local-settings/runtime mismatch safely, while keeping Songi `web-first + local-agent optional/hybrid`.
   - Preserve `readiness.ai_keys.apify` on the server.
   - Expose separate Apify states in `/api/research/integrations`: server configured vs local-agent configured.
   - Do not mark local Apify paid execution as ready until the code path actually uses the local token.
   - Do not make Songi local-agent-required by default.
   - Keep server/company-managed Apify execution working as the web-first path when configured.
   - Implement local-agent Apify only as the optional local-secret/BYOK path. Do not upload a user Apify token to Oracle unless Minsoo explicitly approves that product/security change.

2. Design and, if feasible in this pass, implement the Windows browserless update path.
   - Literal no-download install is impossible; the installer/package bytes must arrive on the PC.
   - For already-installed users, avoid browser downloads by adding an `install_update` or `download_update` local-agent command.
   - Local agent should download in the background, verify size and SHA-256, then launch the installer/update with explicit user confirmation or a tested installer-specific silent mode.
   - Keep browser ticket download only as first-install/fallback.

Safety:

- Do not inspect, copy, or print real API keys, cookies, `.env`, browser profiles, signed URLs, or raw private logs.
- Do not run paid AI/API calls.
- Do not run Apify Actors.
- Do not run real Naver publish/save/draft tests.
- Do not execute a real installer during smoke tests unless Minsoo separately approves it.
- Do not build inside the Shared-Bridge folder. Copy source to a local Windows work folder first.

Suggested no-paid checks:

- Server syntax check.
- App HTML script syntax check.
- Fake heartbeat with `ai_keys.apify=ready` persists.
- `/api/research/integrations` reports `server_configured=false` and `local_configured=true` separately under synthetic local-agent readiness.
- Apify endpoint without `confirm_paid` returns `402` and starts no Actor.
- Fake update manifest downloads a small local test file to the AIMAX update cache, verifies SHA-256, reports progress, and does not create a browser `.crdownload`.
- Hash mismatch deletes temp file and reports a Korean user-readable error.
- Disconnected/old agent path still falls back to browser download.

Return:

- Completion/blocker report in:
  `20_Deploy-To-Windows\2026-05-22-apify-download-updater-next`
- Include changed files, tests run, key output summary, rebuild requirement, deployment requirement, and any remaining risk.
