# Oracle Deploy 2026-05-26 - Songi To Yunmi Bridge

## Scope

- Added a web/server bridge from Songi research items to Yunmi script generation.
- New API:
  - `POST /api/research/items/:itemId/yunmi-script`
- New web action:
  - Songi result card -> `윤미에게 넘기기`

## Behavior

- The bridge reads the authenticated user's Songi research item and project.
- It builds a Yunmi `yunmi_script` payload from Songi's summary, hooks, flow, benchmarking points, copy points, performance notes, personalized plan, script brief, and safe source excerpt.
- If Songi's `script_brief` contains a concrete script topic, that topic is used before the broader project topic.
- It creates a Yunmi no-paid alpha job.
- No paid AI, Apify, Naver publish, Naver save, or local runner action is triggered.

## Demo Account Evidence

- Account inspected: `demo@aimax.ai.kr`
- Existing Songi project: `테스트`
- Existing Songi item:
  - Title: `comment "cut" for access`
  - Item ID: `0e30c9ce-82c4-4c7f-9f32-44bba003b062`
  - Source: Instagram
  - AI analysis status: `completed`
- Live no-paid bridge smoke created Yunmi job:
  - Job ID: `74e4b814-45cd-4d09-b163-37e214fb2230`
  - Kind: `yunmi_script`
  - Status: `done`
  - Stage: `yunmi_script_alpha`
  - Paid total: `0 KRW`
- Topic extraction follow-up smoke created Yunmi job:
  - Job ID: `a88b97fe-489a-4e7d-88cd-a903d119775d`
  - Topic: `AI 직원 채용하기`
  - Status: `done`
  - Stage: `yunmi_script_alpha`
  - Paid total: `0 KRW`

## Files Deployed

- `/home/ubuntu/aimax-reports-api/server.js`
- `/home/ubuntu/aimax-reports-api/static/app.html`

## Backup

- Remote backup before deploy:
  - `/home/ubuntu/aimax-reports/backups/pre-songi-yunmi-bridge-20260526T045348Z`
- Remote backup before topic extraction follow-up:
  - `/home/ubuntu/aimax-reports/backups/pre-songi-yunmi-topic-fix-20260526T045954Z`

## Verification

Local:

- `node --check oracle/aimax-reports-api/server.js`
- `node scripts/smoke_songi_to_yunmi_bridge.mjs`
- `node scripts/smoke_yunmi_alpha.mjs`
- `node scripts/smoke_yunmi_access_gate.mjs`
- `app.html` inline script parse check

Oracle:

- Remote `server.js` syntax check passed.
- Remote `app.html` script parse check passed.
- Restarted user service:
  - `systemctl --user restart aimax-reports-api`
- Internal health:
  - `GET http://127.0.0.1:18988/api/reports/health` -> `ok=true`
- Public health:
  - `GET https://api.aimax.ai.kr/api/reports/health` -> `ok=true`
