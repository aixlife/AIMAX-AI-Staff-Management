# Windows Handoff — R3-C Yeri Local Artifact Consumer

Date: 2026-05-25

## Purpose

Verify and prepare the Windows side of R3-C Yeri Hybrid local artifact consumption.

This phase changes the local runner contract:

- The server may deliver a `yeri_write` job in `ready_for_publish` state with `artifact.content_markdown`.
- The local runner must skip AI text generation and start from parsing/editor input.
- The server claim is still gated behind `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1`, and live Oracle is currently default off.

## Source Bundle

Use the ZIP in this handoff folder:

`aimax_r3c_yeri_local_artifact_consumer_source_bundle_20260525.zip`

SHA256:

`f84ff794808fb36c3246c861892ac8f0ef9600bafff6794dc930e7890f1751e7`

Expected included files:

- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `oracle/aimax-reports-api/static/admin.html`
- `oracle/aimax-reports-api/static/setup.html`
- `app.py`
- `split_version/app.py`
- `web_agent/client.py`
- `scripts/smoke_yeri_ready_claim_gate.mjs`
- `scripts/smoke_yeri_local_artifact_contract.py`
- all R3-A/R3-B regression smokes listed below

## Windows Task

1. Copy the ZIP out of Syncthing/shared folder into a local Windows work folder.
2. Do not build or test inside the shared folder.
3. Overlay the source files onto the current Windows AIMAX work checkout/copy.
4. Run the verification commands.
5. Decide whether Windows installer rebuild is required.
   - Expected answer: yes, because `split_version/app.py` local runner behavior changed.
6. If rebuild is available in your Windows environment, build installer only after smoke passes.
7. Return a Markdown report and any generated installer artifacts to this same shared folder.

## Verification

Run from the local Windows work folder:

```powershell
node --check oracle\aimax-reports-api\server.js
node --check scripts\smoke_yeri_ready_claim_gate.mjs
node --check scripts\smoke_yeri_server_generation_mock.mjs
node --check scripts\smoke_yeri_paid_generation_guard.mjs
node --check scripts\smoke_yeri_hybrid_foundation.mjs
node --check scripts\smoke_yeri_hybrid_retry_api.mjs
node --check scripts\smoke_job_platform_targeting.mjs
python -m py_compile app.py split_version\app.py web_agent\client.py scripts\smoke_yeri_local_artifact_contract.py

python scripts\smoke_yeri_local_artifact_contract.py
node scripts\smoke_yeri_hybrid_foundation.mjs
node scripts\smoke_yeri_server_generation_mock.mjs
node scripts\smoke_yeri_paid_generation_guard.mjs
node scripts\smoke_yeri_ready_claim_gate.mjs
node scripts\smoke_yeri_hybrid_retry_api.mjs
node scripts\smoke_job_platform_targeting.mjs
node scripts\smoke_worker_catalog_contract.mjs
node scripts\smoke_json_storage_safety.mjs
node scripts\smoke_yunmi_access_gate.mjs
```

Expected markers:

```text
YERI_LOCAL_ARTIFACT_CONTRACT_SMOKE_OK
YERI_HYBRID_FOUNDATION_SMOKE_OK
YERI_SERVER_GENERATION_MOCK_SMOKE_OK
YERI_PAID_GENERATION_GUARD_SMOKE_OK
YERI_READY_CLAIM_GATE_SMOKE_OK
YERI_HYBRID_RETRY_API_SMOKE_OK
JOB_PLATFORM_TARGETING_SMOKE_OK
WORKER_CATALOG_CONTRACT_SMOKE_OK
JSON_STORAGE_SAFETY_SMOKE_OK
YUNMI_ACCESS_GATE_SMOKE_OK
```

## Manual/Direct AI Test Scope

Do not run real Naver save/publish.

If Windows can run a local-only direct test without Naver mutation:

- Create a mock `ready_for_publish` job with `image_count=0`.
- Confirm the agent receives `artifact.content_markdown` when `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1`.
- Confirm local source contract skips `generate_blog_content` for artifact jobs.

Do not enter customer credentials or use real API keys.

## No-Paid / No-Mutation Rules

- Do not run real Gemini/OpenAI/Claude/Apify calls.
- Do not set `AIMAX_YERI_SERVER_GENERATION_ENABLED=1` with `confirm_paid=true`.
- Do not run Naver login, save, publish, scheduled publish, or browser automation.
- Do not place API keys, cookies, `.env`, browser profiles, signed URLs, or private logs into Syncthing.

## Return Report

Create:

`WINDOWS_RESULT_20260525_r3c_yeri_local_artifact_consumer.md`

Include:

- verdict: `pass`, `blocked`, or `fail`
- Windows OS / Node / Python versions
- exact smoke outputs
- Windows path issues, if any
- whether installer rebuild is required
- if rebuilt: artifact filename, size, sha256
- confirmation that no paid/mutation operations ran
- blockers and suggested fixes

## Mac/Server Status

Mac/server implementation and no-paid smoke passed.

Oracle web deployment completed:

- Deploy report: `docs/deployments/oracle-deploy-20260525-020730.md`
- Live `server.js` sha256: `c1ccdcbb864071b9b36c6ce8c9d1b9355d99368b82d9e41e69fecd42a4ae6163`
- Health: `ok=true`, storage `ok=true`
- Important: live claim flag is default off.

