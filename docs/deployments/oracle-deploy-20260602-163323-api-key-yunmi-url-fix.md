# Oracle Deploy 2026-06-02 16:33 KST - Songi Gemini Key And Yunmi URL Fix

## Scope

- Narrow web deploy of:
  - `/home/ubuntu/aimax-reports-api/server.js`
  - `/home/ubuntu/aimax-reports-api/static/app.html`
- No installer, version API, paid AI call, Apify run, Naver action, or customer credential test was performed.

## Fixes

- Songi Gemini analysis now classifies Google `API_KEY_INVALID` as `research_gemini_invalid_api_key` instead of generic `research_gemini_bad_request`.
- The web app now tells users to replace the stored Gemini API key when that error occurs.
- Yunmi no longer treats `reference_url` as spoken evidence in script rows.
- Yunmi now blocks URL-only submissions and asks for a topic, objective, or reference memo.
- `scripts/smoke_yunmi_alpha.mjs` now verifies URL-only blocking and prevents URL leakage into generated dialogue.

## Report Handling

- `AIMAX-RPT-20260602070559-07666cf9`: moved from `new` to `waiting_user` because the user must replace the invalid Gemini key.
- `AIMAX-RPT-20260602071428-cb7806fa`: moved from `new` to `done` after code fix, deploy, and local UI verification.

## Hashes

- `server.js`: `fa44c121079d8c9d9fe9af6a96bd42ddb8aa120929e401b24937c891c4a17d5a`
- `app.html`: `716078918f69f7310657343b758c5bdffb67e59646845dc4b842ab7449d4acbb`
- `scripts/smoke_yunmi_alpha.mjs`: `18c5e1582510b6ffbb29149c5e22d1e6971d0c30fd083c71b5cf4cc54153f873`

## Backup

- Remote pre-deploy backup:
  - `/home/ubuntu/aimax-backups/20260602-163323-api-key-yunmi-url-fix/`
- Report status backups:
  - `/home/ubuntu/aimax-reports/data/reports-index.jsonl.bak-20260602073559-api-key-yunmi-report-triage`
  - `/home/ubuntu/aimax-reports/data/reports/2026-06-02/AIMAX-RPT-20260602070559-07666cf9.json.bak-20260602073559-api-key-yunmi-report-triage`
  - `/home/ubuntu/aimax-reports/data/reports/2026-06-02/AIMAX-RPT-20260602071428-cb7806fa.json.bak-20260602073559-api-key-yunmi-report-triage`

## Verification

- Local:
  - `node --check oracle/aimax-reports-api/server.js`
  - `node --check scripts/smoke_yunmi_alpha.mjs`
  - `node scripts/smoke_yunmi_alpha.mjs`
  - `app.html` inline script parse check
- Local UI:
  - Logged into temporary local account.
  - Confirmed Yunmi URL-only submission shows: `URL만으로는 대본 내용을 추출하지 않습니다.`
  - Confirmed Yunmi result generated with topic/objective/reference URL does not include URL text in the script result.
- Oracle:
  - Remote `server.js` syntax check passed.
  - Remote `app.html` inline script parse check passed.
  - `systemctl --user is-active aimax-reports-api` returned `active`.
  - Internal health returned `ok:true`.
  - Public health returned `ok:true`.
