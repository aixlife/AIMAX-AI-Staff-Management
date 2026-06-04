# Oracle Deploy 20260604-151232 - Sangsu Email And Yunmi Shortform Flow

## Scope

- Targeted web deploy only.
- Updated files:
  - `/home/ubuntu/aimax-reports-api/server.js`
  - `/home/ubuntu/aimax-reports-api/static/app.html`
- No paid AI/API test was run in this deploy.

## Changes

- Sangsu quote UI now has a client email input.
- Sangsu quote preview and PDF/print HTML include the client email in the basic information table.
- Yunmi no-paid alpha script wording now uses a more natural spoken flow.
- Yunmi Gemini generation prompt now explicitly includes the shortform meta-prompt rules:
  - first 2-3 second hook
  - no explanatory intro such as "오늘은 ~에 대해 알아보겠습니다"
  - hook method candidates
  - time-coded 0-3, 3-10, 10-25, 25-40, 40-55, closing structure
  - empathy before CTA
  - final recommendation criteria

## Backup

- Remote backup:
  - `/home/ubuntu/aimax-backups/20260604-151232-sangsu-yunmi/`
- Remote staging:
  - `/tmp/aimax-sangsu-yunmi-20260604-151232/`

## Hashes

Local and deployed remote hashes:

```text
d96dd3ee7e4230e42e1501009ba9c88a3f807bd2935c35d59e7fc25cbdc975fe  server.js
7e7a209f025f253c76d0a22ef561b0d5772d21242ee9770a234db0f57d4b73fd  app.html
```

## Verification

Pre-deploy local:

- `node --check oracle/aimax-reports-api/server.js`
- `node --check scripts/smoke_yunmi_alpha.mjs`
- `node scripts/smoke_worker_catalog_contract.mjs`
- `node scripts/smoke_yunmi_alpha.mjs`
- `node scripts/smoke_songi_to_yunmi_bridge.mjs`
- `node scripts/smoke_sangsu_yunmi_ui.mjs`

Evidence:

- `docs/testing/evidence/sangsu-yunmi-ui-20260604/sangsu-email.png`
- `docs/testing/evidence/sangsu-yunmi-ui-20260604/yunmi-result.png`

Post-deploy remote:

- `systemctl --user is-active aimax-reports-api.service` -> `active`
- `node --check /home/ubuntu/aimax-reports-api/server.js`
- Public `https://api.aimax.ai.kr/api/reports/health` -> `ok:true`
- Public `/app` HTML contains:
  - `sangsuClientEmail`
  - `윤미 숏폼 스크립트`
  - `yunmiGenerationMode`
- Remote server source contains Yunmi prompt markers:
  - `첫 2~3초`
  - `CTA 전에 반드시 공감`
  - `후킹 방식은 아래 중`
  - `그냥 넘기는 순간은`
