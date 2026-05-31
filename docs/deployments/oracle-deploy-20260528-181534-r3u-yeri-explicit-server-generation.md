# Oracle Deploy 20260528-181534 R3-U Yeri Explicit Server Generation

- mode: `web`
- host: `oracle-server`
- app_dir: `/home/ubuntu/aimax-reports-api`
- service: `aimax-reports-api.service`
- remote_backup: `/home/ubuntu/aimax-backups/20260528-181451-r3u-yeri-explicit-server-generation`

## Change

- Yeri server generation now runs only when the browser explicitly sends `server_generation=true`.
- Normal local Yeri jobs remain queued for the Windows runner when `server_generation` is not requested.
- In real-test server generation mode, the UI can show the paid confirmation dialog even when local AI readiness is already `ready`, so the fallback path can be verified without trying to corrupt local key state.

## Files

| file | sha256 |
|---|---|
| `/home/ubuntu/aimax-reports-api/server.js` | `9e87e55e0de8094027d81683d61a5a4f6562f79f10f185e8f38f02fb62101a36` |
| `/home/ubuntu/aimax-reports-api/static/app.html` | `0c85262318819f59d62a4c6c2d30cde5a2044d144cf1bed0a06baa1442958414` |

## Verification

- `node --check oracle/aimax-reports-api/server.js`
- `YERI_PAID_GENERATION_GUARD_SMOKE_OK`
- `YERI_REAL_TEST_GUARD_SMOKE_OK`
- `YERI_SERVER_GENERATION_MOCK_SMOKE_OK`
- `YERI_READY_CLAIM_GATE_SMOKE_OK`
- `YERI_HYBRID_RETRY_API_SMOKE_OK`
- Oracle local health OK.
- Public HTTPS health OK.
- Public `/app` HTML includes `server_generation=true` submit path and updated server-generation confirmation copy.

## Safety

- No paid AI call was made.
- No Naver publish, schedule, edit, or save was made.
- No customer credentials, API keys, cookies, signed URLs, or passwords were exposed.
- No live installer rollout or Oracle version API change was performed in this deploy.
