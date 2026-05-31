Read first:
`20_Deploy-To-Windows\2026-05-22-apify-download-updater-next\SEQUENTIAL_PLAN_20260522_songi_web_first_hybrid.md`

Then read:
`20_Deploy-To-Windows\2026-05-22-apify-download-updater-next\MAC_COMPLETION_20260522_apify_local_readiness_deployed.md`

Important product decision update:

Do NOT implement Songi Apify as a local-agent-required feature.

New direction:

- Songi must be web-first.
- Apify token must be usable from the web/server path.
- Users should enter/manage the Apify token in the web app, or the server should use an approved company/server-managed token.
- Local agent should be kept primarily for Blog Team/Naver browser automation and Windows updater work.
- Avoid making Songi depend on the local agent.

What changed:

- The earlier local Apify readiness hotfix only stopped the web app from falsely saying `키 없음`.
- That local-readiness path should now be treated as transitional/diagnostic only.
- Do not build a Windows-only local Apify execution path unless Minsoo explicitly reopens that as an optional privacy mode later.

Mac/server work now needed:

- Add web-side Apify token management:
  - save/replace token;
  - status check;
  - delete token;
  - never return raw token to browser;
  - encrypt at rest;
  - redact from logs/reports/diagnostics.
- Make Songi Apify endpoints use per-user encrypted server-side Apify token first, then approved company/server token if configured.
- Keep explicit paid confirmation before Apify Actor runs.
- Add no-paid mocked tests before any real Apify call.

Windows developer task:

1. Do not continue the previous local-agent Apify execution task.
2. Review Windows local settings UI:
   - If it has an `Apify API Token` field, do not imply Songi web will use that local-only token.
   - Either mark it as legacy/local-only, hide it after web settings exists, or change text to direct users to the web Apify settings.
3. Continue Windows work only for:
   - Blog Team local automation stability;
   - Windows installer/updater/browserless update path;
   - making sure Windows app does not regress after server/web Apify changes.
4. When Mac/server returns the new web Apify token UI/API, verify Windows users can use Songi from the web without local agent.

Safety:

- Do not inspect, copy, print, or sync real Apify tokens.
- Do not run real Apify Actors.
- Do not run paid AI/API calls.
- Do not run real Naver publish/save/draft tests.
- Do not place `.env`, cookies, browser profiles, session tokens, setup links, signed URLs, raw private logs, or API keys in Shared-Bridge.

No-paid checks for Windows:

- Existing Blog Team local settings still save/load required Naver and AI keys.
- Apify local field, if present, has clear non-Songi-web wording.
- Web Songi page can be opened without requiring local agent.
- Windows updater/browserless download tests remain mocked/fake-file only unless explicitly approved.

Return:

Write completion/blocker report in:
`20_Deploy-To-Windows\2026-05-22-apify-download-updater-next`

Include:

- whether previous local-agent Apify implementation was stopped or reverted;
- local settings UI changes, if any;
- Windows updater status;
- any Mac/server follow-up needed;
- tests run and summarized outputs.

