# Windows Handoff - Yeri selected AI model routing verification

Date: 2026-06-02
Status: Windows production verification request

## Context

Mac/Oracle deployed a targeted web/API hotfix for Yeri blog writing model routing.

User issue:
- In 예리 블로그 글쓰기, the user selects an AI model.
- The generated writing path should use the selected model.
- Before this hotfix, server generation fallback could use Gemini even when Claude/OpenAI was selected.

Production deploy record:
- `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260602-000636-yeri-selected-model-routing.md`

Remote deployed hashes:
- `/home/ubuntu/aimax-reports-api/server.js`
  - `665096ed944a94ebdcff2e70fbe9fed850cc6b9a93386eadab0afca7d5ff5363`
- `/home/ubuntu/aimax-reports-api/static/app.html`
  - `813cbc347515aa1403e6aaf17d75d8e85e03fd7d1ac2bcd1a753355e26aaaa94`

## What Changed

- Server-side Yeri server generation now dispatches by selected `payload.ai_model`:
  - Gemini -> Gemini API
  - `claude` -> Claude API
  - `gpt-*` -> OpenAI Responses API
- `/api/workers` advertises Yeri server-generation `supported_providers: ["gemini", "openai", "claude"]`.
- Web UI fallback/confirmation copy uses the selected provider label instead of hard-coded Gemini.
- Local runner queued jobs keep `payload.ai_model` intact for the installed runner path.

## No-Paid Verification Already Passed On Mac

```text
node --check oracle/aimax-reports-api/server.js
node --check scripts/smoke_yeri_selected_model_routing.mjs
node --check scripts/smoke_yeri_server_generation_mock.mjs
node scripts/smoke_yeri_selected_model_routing.mjs -> YERI_SELECTED_MODEL_ROUTING_SMOKE_OK
node scripts/smoke_yeri_server_generation_mock.mjs -> YERI_SERVER_GENERATION_MOCK_SMOKE_OK
node scripts/smoke_yeri_web_user_flow_contract.mjs -> YERI_WEB_USER_FLOW_CONTRACT_OK
node scripts/smoke_worker_catalog_contract.mjs -> WORKER_CATALOG_CONTRACT_SMOKE_OK
app.html script syntax check -> APP_HTML_SCRIPT_SYNTAX_OK 1
```

## Windows Task

Do not edit production code unless a blocker proves the deployed hotfix is missing.

1. Read this handoff first.
2. If using source, copy the repo out of Syncthing into a local Windows work folder. Do not build or run inside the shared folder.
3. Verify production web/API from Windows:
   - Production web app loads.
   - `/api/workers` or browser-observed worker config includes Yeri `supported_providers` with `gemini`, `openai`, and `claude`.
   - 예리 model selector still offers Gemini 2.5 Pro, Gemini 2.5 Flash, GPT-5.4 mini, GPT-5 mini, Claude.
   - Selecting Claude/OpenAI does not show Gemini-only server-generation copy.
   - If a server-generation confirmation appears, it names the selected provider/model, not Gemini.
4. Run no-paid source smoke if the current source checkout is available:
   - `node scripts/smoke_yeri_selected_model_routing.mjs`
   - Expected: `YERI_SELECTED_MODEL_ROUTING_SMOKE_OK`
5. Do not run a real paid Yeri generation unless Minsoo separately approves:
   - provider/model
   - account
   - exact action
   - input size
   - max cost
   - mutation limit
   - retry/resume rule

## Return Report

Write a completion or blocker report back to the same Syncthing folder with:

- Windows OS/browser
- tested account identifier, masked
- production `/api/workers` or UI evidence for supported providers
- selected model UI result for Claude/OpenAI/Gemini
- whether any copy still says Gemini when Claude/OpenAI is selected
- no-paid smoke result if run
- screenshots or copied visible text
- confirmation that no paid AI/API generation, Apify, Naver publish, or Naver schedule action was run
- blocker details, if any
