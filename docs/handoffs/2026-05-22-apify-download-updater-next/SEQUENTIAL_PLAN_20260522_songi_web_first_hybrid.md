# Sequential Plan 20260522 - Songi Web-First Hybrid And Windows Updater

Date: 2026-05-22 KST

## Product Principle

New AIMAX employees must be classified before implementation:

- `web-first`: core work can run safely from the web/server.
- `local-agent-required`: core work requires local OS/browser/files.
- `hybrid`: web-first by default, local agent for local-only secrets or OS-specific actions.

Songi should be `web-first`. Local-agent Apify execution is no longer the active direction unless Minsoo explicitly reopens it as a future optional privacy mode.

Blog Team is local-agent-required because it controls a local/browser Naver workflow. Songi is a research employee, so it should not require the local agent by default.

## Current Status

Mac/Oracle A1 is completed and deployed:

- Oracle preserves `readiness.ai_keys.apify`.
- `/api/research/integrations` separates server and local Apify states.
- Web UI can show `PC Apify 토큰 저장됨`.
- Paid local Apify execution remains disabled and should not be implemented as the current path.

Important: Songi should run Apify from the web/server path. The next task is web-side Apify token management or approved company/server-managed credentials.

## Remaining Work Split

### Mac / Server / Web

1. Keep Songi web-first:
   - Server/company-managed Apify/Gemini credentials should allow Songi to work from the web without requiring the local agent.
   - Per-user server-stored Apify BYOK is now the preferred user-token direction, with encrypted storage and careful redaction.

2. Maintain clear integration states:
   - `server_configured=true`: web-first provider execution available.
   - `local_configured=true`: a connected local agent reports a local token.
   - `local_execution_available` should remain false unless a future optional privacy mode is explicitly approved.

3. UX:
   - Do not tell users merely `키 필요` when their PC token is present.
   - Do not tell users Songi is fully ready if the selected execution path cannot run.
   - Explain that Songi Apify runs from web/server settings, not the local agent.

4. Verification:
   - No-paid server syntax and app script checks.
   - No-paid integration status smoke.
   - Public `/app` marker check after deploy.
   - No real Apify Actor unless explicitly approved.

### Windows / Local Agent

1. Sync latest Mac/Oracle contract:
   - Do not revert the deployed A1 behavior.
   - Treat Songi as web-first, not local-agent-required.

2. Stop local Apify execution work:
   - Do not implement Songi Apify as a Windows local-agent command.
   - Review local settings wording so users are not told that a local Apify token powers Songi web.
   - Wait for Mac/server web Apify settings/API before validating end-to-end Songi Apify.

3. Windows updater:
   - For already-installed users, avoid browser download by using local-agent update command.
   - Keep browser ticket download as first-install/fallback.
   - Verify download size/SHA-256 before running any installer.

## Gates

Gate 1: Web-first token decision

- Implement per-user encrypted web Apify token storage, or configure an approved company/server-managed token.
- Verify `server_configured=true` or per-user `configured=true` without exposing token values.
- Do not depend on local-only BYOK for Songi's default path.

Gate 2: Apify execution

- No-paid mocked server-side end-to-end test must pass before any real Apify run.
- Real Apify run requires explicit approval with provider/action/cost.

Gate 3: Windows updater

- Fake update manifest and fake file tests must pass before real installer execution.
- Real installer execution requires explicit approval.

## Immediate Next Actions

Mac/Server:

- Implement/plan web Apify token management and encrypted server-side storage.
- Confirm whether Oracle has server/company-managed Apify and Gemini credentials configured without exposing values.
- If missing, report that web-first provider execution is not operational until credentials or the approved per-user web token model is added.

Windows:

- Read this plan plus the updated copy-paste prompt.
- Do not implement the local-agent Apify path.
- Continue Windows updater and local settings wording checks.
- Return whether any shared Mac/server code must be changed again.

## Safety

- No API keys, cookies, `.env`, browser profiles, session tokens, signed URLs, or raw private logs in Shared-Bridge.
- No paid AI/API calls.
- No Apify Actor runs.
- No Naver publish/save/draft tests.
