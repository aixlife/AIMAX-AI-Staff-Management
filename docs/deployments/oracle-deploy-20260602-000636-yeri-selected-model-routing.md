# Oracle Deploy 20260602-000636 - Yeri selected model routing

- mode: targeted web hotfix
- host: `oracle-server`
- remote app dir: `/home/ubuntu/aimax-reports-api`
- remote backup: `/home/ubuntu/aimax-backups/20260602-000636-yeri-selected-model`
- service: `aimax-reports-api.service`

## Scope

Fixed Yeri blog writing server-generation routing so the selected writing model is respected:

- Gemini-selected jobs use Gemini.
- Claude-selected jobs use Claude server generation when server generation is needed.
- OpenAI/GPT-selected jobs use OpenAI server generation when server generation is needed.
- Local runner queued jobs keep `payload.ai_model` intact for the installed runner path.

No paid AI generation, Apify run, Naver publish, Naver schedule, or customer credential action was performed during verification.

## Files

| label | remote | sha256 |
|---|---|---|
| api server | `/home/ubuntu/aimax-reports-api/server.js` | `665096ed944a94ebdcff2e70fbe9fed850cc6b9a93386eadab0afca7d5ff5363` |
| web app | `/home/ubuntu/aimax-reports-api/static/app.html` | `813cbc347515aa1403e6aaf17d75d8e85e03fd7d1ac2bcd1a753355e26aaaa94` |

## Verification

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

Remote checks:

```text
/api/reports/health -> ok=true, storage ok=true
aimax-reports-api.service -> active
/api/version?platform=windows&current_version=v1.0.39 -> latest/min v1.0.39, update_required=false
/app contains serverGenerationSupportsModel and selected-model confirmation copy
```

## Result

Deployment completed. The production service was restarted and returned `active`.
