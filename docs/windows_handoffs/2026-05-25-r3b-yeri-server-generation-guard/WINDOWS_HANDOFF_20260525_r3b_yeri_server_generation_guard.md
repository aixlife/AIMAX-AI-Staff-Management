# Windows Handoff — R3-B Yeri Server Generation Guard

Date: 2026-05-25

## Purpose

Verify the R3-B Yeri hybrid server-generation guard on Windows Codex without paid API calls.

This is a server/web change only. It should not require rebuilding the Windows installer yet.

## What Changed

Mac/server side implemented:

- Feature flags:
  - `AIMAX_YERI_SERVER_GENERATION_MOCK`
  - `AIMAX_YERI_SERVER_GENERATION_ENABLED`
  - `AIMAX_YERI_SERVER_GENERATION_MODEL`
  - `AIMAX_YERI_SERVER_GENERATION_TIMEOUT_MS`
- Mock server artifact generation for `yeri_write`
- Real Gemini server generation function behind `AIMAX_YERI_SERVER_GENERATION_ENABLED`
- Paid guard: real generation requires `confirm_paid=true`
- `ready_for_publish` remains non-claimable by local agents until local artifact consumption lands

## Source Bundle

Use the ZIP in this handoff folder:

`aimax_r3b_yeri_server_generation_guard_source_bundle_20260525.zip`

SHA256:

`2ac3f50ec6723511538ae7e2c49d299f7a127b74adc0302337c1f49235a1648b`

Expected included files:

- `oracle/aimax-reports-api/server.js`
- `scripts/smoke_yeri_server_generation_mock.mjs`
- `scripts/smoke_yeri_paid_generation_guard.mjs`
- `scripts/smoke_yeri_hybrid_foundation.mjs`
- `scripts/smoke_yeri_hybrid_retry_api.mjs`
- `scripts/smoke_job_platform_targeting.mjs`
- `scripts/smoke_worker_catalog_contract.mjs`
- `scripts/smoke_json_storage_safety.mjs`
- `scripts/smoke_yunmi_access_gate.mjs`
- `app.py`
- `split_version/app.py`
- `web_agent/client.py`

## Windows Task

1. Copy this ZIP out of Syncthing/shared folder into a local Windows work folder.
2. Do not build or run from inside the shared folder.
3. Apply/overlay the source files onto the current Windows work checkout/copy.
4. Run verification below.
5. Return a Markdown report to this same shared folder.

## Verification

Run from the local Windows work folder:

```powershell
node --check oracle\aimax-reports-api\server.js
node --check scripts\smoke_yeri_server_generation_mock.mjs
node --check scripts\smoke_yeri_paid_generation_guard.mjs
node --check scripts\smoke_yeri_hybrid_foundation.mjs
node --check scripts\smoke_yeri_hybrid_retry_api.mjs
node --check scripts\smoke_job_platform_targeting.mjs
python -m py_compile app.py split_version\app.py web_agent\client.py

node scripts\smoke_yeri_hybrid_foundation.mjs
node scripts\smoke_yeri_server_generation_mock.mjs
node scripts\smoke_yeri_paid_generation_guard.mjs
node scripts\smoke_yeri_hybrid_retry_api.mjs
node scripts\smoke_job_platform_targeting.mjs
node scripts\smoke_worker_catalog_contract.mjs
node scripts\smoke_json_storage_safety.mjs
node scripts\smoke_yunmi_access_gate.mjs
```

Expected markers:

```text
YERI_HYBRID_FOUNDATION_SMOKE_OK
YERI_SERVER_GENERATION_MOCK_SMOKE_OK
YERI_PAID_GENERATION_GUARD_SMOKE_OK
YERI_HYBRID_RETRY_API_SMOKE_OK
JOB_PLATFORM_TARGETING_SMOKE_OK
WORKER_CATALOG_CONTRACT_SMOKE_OK
JSON_STORAGE_SAFETY_SMOKE_OK
YUNMI_ACCESS_GATE_SMOKE_OK
```

## No-Paid / No-Mutation Rules

- Do not run real Gemini/OpenAI/Claude/Apify calls.
- Do not set `AIMAX_YERI_SERVER_GENERATION_ENABLED=1` with `confirm_paid=true`.
- Do not trigger Naver login, save, publish, or browser automation.
- Do not place API keys, cookies, `.env`, browser profiles, or secrets into the shared folder.

## Return Report

Create:

`WINDOWS_RESULT_20260525_r3b_yeri_server_generation_guard.md`

Include:

- verdict: `pass`, `blocked`, or `fail`
- Windows OS / Node / Python versions
- exact smoke outputs
- whether any path issue occurred on Windows
- confirmation that `ready_for_publish` was not claimed by an agent
- confirmation that paid guard returned `yeri_paid_confirmation_required`
- whether Windows rebuild is required (expected: no)
- blockers and suggested fixes if any

## Mac/Server Deployment Status

Oracle web deployment completed.

- Deploy report: `docs/deployments/oracle-deploy-20260525-014442.md`
- Live `server.js` sha256: `c6281f4f32c45514a2e7c3d80e71ee6ff4c15c9d5677954033b4edaed3ebe780`
- Health: `ok=true`, storage `ok=true`
