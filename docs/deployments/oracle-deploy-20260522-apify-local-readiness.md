# Oracle Deploy 20260522 Apify Local Readiness Hotfix

## Summary

Deployed a server/web hotfix for the Songi Apify local-settings mismatch.

The issue was a Mac/Oracle-side plus Windows-local boundary mismatch:

- Windows/macOS local settings could save and report an Apify token locally.
- Oracle discarded `readiness.ai_keys.apify`.
- Songi web checked only server-side `APIFY_API_TOKEN`, so a locally saved token still appeared as missing.

## Mac / Server Work Completed

- `oracle/aimax-reports-api/server.js`
  - preserves `readiness.ai_keys.apify`;
  - exposes separate Apify states in `/api/research/integrations`:
    - `configured`: server-side execution readiness, kept compatible with existing paid server execution;
    - `server_configured`;
    - `local_configured`;
    - `agent_ready`;
    - `local_execution_available: false`;
    - `execution_mode`.
  - marks newly created SNS research items as `apify_local_pending` when the connected local agent has an Apify token but local-agent Apify execution is not implemented yet.
- `oracle/aimax-reports-api/static/app.html`
  - shows `PC Apify 토큰 저장됨` instead of only `Apify 키 필요` when the local agent reports Apify ready.
  - keeps paid Apify buttons gated on the existing server execution path.
- `scripts/smoke_apify_local_readiness.mjs`
  - no-paid smoke test for heartbeat readiness preservation and integration status splitting.
  - also verifies that a synthetic Instagram item becomes `apify_local_pending` when only local Apify readiness is present.

## Windows Work Still Required

- Implement actual local-agent Apify execution if Songi should use the user's local Apify token.
- Add command/job types for Songi Apify item/profile collection.
- Return sanitized Apify results to Oracle without exposing tokens or signed media URLs.
- Implement browserless Windows updater separately as described in the Windows handoff.

## Local Verification

- `node --check oracle/aimax-reports-api/server.js`: passed.
- app HTML embedded script syntax check: `APP_HTML_SCRIPT_SYNTAX_OK`.
- `node scripts/smoke_apify_local_readiness.mjs`: `APIFY_LOCAL_READINESS_SMOKE_OK`.

Smoke assertions:

- heartbeat with `readiness.ai_keys.apify="ready"` is preserved;
- `/api/research/integrations` returns:
  - `apify.configured=false`;
  - `apify.server_configured=false`;
  - `apify.local_configured=true`;
  - `apify.execution_mode="local_pending"`;
  - `apify.local_execution_available=false`.

## Deployed Files

Local SHA-256:

- `oracle/aimax-reports-api/server.js`
  - `c5c59723621a267dd965f22f944d2e436396862417b3b41501754088f8ccd180`
- `oracle/aimax-reports-api/static/app.html`
  - `f92bac92e0995b81f0bb729fe0d1c03ff1c343206262016c6a2229b138e83ca7`
- `scripts/smoke_apify_local_readiness.mjs`
  - `00166eaea5cce29ccef2d8fe040d7f477d9060c06b75c87e3d8d522c8d49ab85`

Remote SHA-256 after upload:

- `/home/ubuntu/aimax-reports-api/server.js`
  - `c5c59723621a267dd965f22f944d2e436396862417b3b41501754088f8ccd180`
- `/home/ubuntu/aimax-reports-api/static/app.html`
  - `f92bac92e0995b81f0bb729fe0d1c03ff1c343206262016c6a2229b138e83ca7`

## Backups

- `/home/ubuntu/aimax-reports-api/server.js.bak-20260522-apify-local-readiness`
- `/home/ubuntu/aimax-reports-api/server.js.bak-20260522-apify-local-pending-item`
- `/home/ubuntu/aimax-reports-api/static/app.html.bak-20260522-apify-local-readiness`

## Oracle Runtime Verification

- `node --check /home/ubuntu/aimax-reports-api/server.js`: passed.
- AIMAX API is listening on `127.0.0.1:18988`.
- Public `/api/version?platform=windows&current=v1.0.15` returned `ok=true`.
- Public `/app` contains new hotfix markers:
  - `local_configured`;
  - `apify_local_pending`;
  - `PC Apify 토큰 저장됨`.
- Current Oracle process environment check shows web-first provider env vars missing:
  - `APIFY_API_TOKEN:missing`;
  - `AIMAX_APIFY_API_TOKEN:missing`;
  - `GEMINI_API_KEY:missing`;
  - `AIMAX_GEMINI_API_KEY:missing`.
  - This means Songi web-first provider execution is not operational from environment variables until server/company-managed credentials are configured or another approved secret path is added.

## Safety

- No real Apify token was inspected.
- No Apify Actor was run.
- No paid AI/provider call was made.
- No real Naver publish/save/draft test was run.
- No customer data, API keys, cookies, `.env`, browser profiles, setup links, signed URLs, or raw private logs were copied into Shared-Bridge.

## Residual Risk

- This hotfix only makes the local Apify token state truthful in the web app.
- It does not yet make Songi run Apify with the local token.
- Windows/local-agent work is still required for actual local Apify collection.
- Server/company-managed Apify/Gemini credentials are not present in the current Oracle process environment, so true web-first provider execution still needs credential setup or an explicitly approved server-side secret model.
- Code signing/browserless update work is separate and still belongs to the Windows updater track.
