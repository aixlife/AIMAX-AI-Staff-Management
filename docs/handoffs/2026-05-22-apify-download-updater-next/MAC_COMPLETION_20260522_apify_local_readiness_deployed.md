# Mac Completion 20260522 - Apify Local Readiness Hotfix Deployed

Date: 2026-05-22 KST

## Mac / Oracle Completed

- Deployed Oracle/web hotfix for the Apify local-settings mismatch.
- Server now preserves `readiness.ai_keys.apify`.
- `/api/research/integrations` now distinguishes:
  - `apify.configured`: server-side Apify execution ready;
  - `apify.server_configured`;
  - `apify.local_configured`;
  - `apify.agent_ready`;
  - `apify.local_execution_available: false`;
  - `apify.execution_mode`.
- Songi web now shows `PC Apify 토큰 저장됨` when the connected local agent reports Apify ready.
- Paid Apify buttons remain disabled unless the existing server-side execution path is configured.

## Mac / Oracle Verification

- `node --check oracle/aimax-reports-api/server.js`: passed.
- app HTML embedded script syntax check: `APP_HTML_SCRIPT_SYNTAX_OK`.
- `node scripts/smoke_apify_local_readiness.mjs`: `APIFY_LOCAL_READINESS_SMOKE_OK`.
- Remote Oracle file SHAs match local:
  - `server.js`: `da0bf061e31cf7b92b556d6b735bae80cf78ad7c4bf74a7c9e2b44f55ed4a4db`
  - `app.html`: `f92bac92e0995b81f0bb729fe0d1c03ff1c343206262016c6a2229b138e83ca7`
- Public `/api/version?platform=windows&current=v1.0.15`: `ok=true`.
- Public `/app` includes:
  - `local_configured`;
  - `apify_local_pending`;
  - `PC Apify 토큰 저장됨`.
- Oracle process environment currently has no server/company-managed provider env vars:
  - `APIFY_API_TOKEN:missing`;
  - `AIMAX_APIFY_API_TOKEN:missing`;
  - `GEMINI_API_KEY:missing`;
  - `AIMAX_GEMINI_API_KEY:missing`.
- Therefore, Songi web-first provider execution still needs server/company-managed credentials or an explicitly approved server-side secret model.

## Windows Still Needed

- Do not duplicate the Mac/server A1 patch unless your local Windows source is behind and needs syncing.
- Treat Songi as `web-first + local-agent optional/hybrid`, not local-agent-required.
- Continue with actual Windows/local-agent work:
  - local-agent Apify execution path;
  - mocked/no-paid Apify command tests;
  - browserless update command path for already-installed users.

## Safety

- No Apify Actor was run.
- No paid API call was made.
- No Naver publish/save/draft action was run.
- No secrets or raw private logs were copied.
