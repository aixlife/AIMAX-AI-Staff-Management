# AIMAX Architecture Reset 2026-05-23

## 판단

현재 문제는 단일 버그가 아니라 운영 구조 문제다.

- 직원 정의가 서버 `PRODUCTS / WORKERS / JOB_KINDS`, 웹 하드코딩 UI, admin 권한, 로컬 실행기 readiness에 나뉘어 있다.
- API 키가 로컬 실행기와 웹 암호화 저장소에 따로 존재해 사용자가 "저장했다"고 느끼는 위치와 실제 직원이 읽는 위치가 다르다.
- 블로그팀은 네이버 브라우저 자동화 때문에 로컬 실행기가 필요하지만, AI 글/이미지 생성까지 로컬에 묶여 키 누락/버전 드리프트가 작업 실패로 이어진다.
- macOS/Windows 빌드가 수동 handoff 중심이라 서버 계약 변경과 설치본 반영 사이에 불일치가 생긴다.

AI Council 합의:

- 웹/로컬/카탈로그의 source of truth를 통합해야 한다.
- 송이, 윤미 같은 신규 직원은 기본 `web-first`로 두고 로컬 실행기를 요구하지 않아야 한다.
- 예리/현주는 네이버 브라우저 자동화 때문에 `local-agent-required`이지만, 예리의 AI 글/이미지 생성은 서버로 옮기는 방향이 맞다.
- 로컬 실행기는 장기적으로 "네이버 계정/브라우저 조작기"로 좁히고, provider API 키는 웹 암호화 저장소를 기준으로 관리해야 한다.

## 운영 증거

Sanitized production snapshot:

- active users: 165
- must_change_password: 104
- agent rows: 39, but seen within 15 minutes: 6, within 1 hour: 7, within 1 day: 13
- 7-day jobs:
  - `hyunju_find:done`: 123
  - `yeri_write:failed`: 62
  - `yeri_write:done`: 11
- 7-day yeri failure classes:
  - unknown/other: 30
  - content_generation: 12
  - local_key_missing: 9
  - editor_contract: 8
  - browser_driver: 2
  - editor_input: 1
- 7-day reports:
  - total: 22
  - Windows: 21
  - macOS: 1
  - setup/key/token class: 18
- Newest report class:
  - Windows v1.0.17, Yeri stuck/failure
  - local job log says local Naver account or AI API key required

## 직원 실행 모델

| 직원 | 현재 역할 | 목표 실행 모델 | 이유 |
| --- | --- | --- | --- |
| 예리 | 네이버 블로그 글쓰기 | hybrid now, server-generation + local-editor target | 네이버 편집기는 로컬 브라우저가 필요하지만 AI 생성은 웹 키로 서버 처리 가능 |
| 현주 | 네이버 서로이웃/영업 | local-agent-required | 네이버 브라우저 자동화가 핵심 |
| 송이 | 자료조사원 | web-first | URL/API/SNS 수집은 서버에서 처리 가능, 로컬 실행기 요구 금지 |
| 윤미 | 스크립트작가 | web-first beta -> web-first public | 브라우저 자동화 불필요 |
| 나경/현성/상수 | planned | hidden/planned unless contract complete | 반쪽 노출 방지 |

## 비밀/설정 원칙

1. Naver ID/password/session은 기본적으로 로컬 전용이다.
2. Gemini/OpenAI/Claude/Apify provider secrets는 웹 암호화 저장소를 기준으로 한다.
3. 로컬 설정 창은 provider keys를 삭제하거나 덮어쓰면 안 된다.
4. 웹 AI/API 설정과 로컬 네이버 설정을 같은 화면 의미로 섞지 않는다.
5. 기존 로컬 provider keys는 사용자가 승인하면 웹으로 import할 수 있다.
6. 웹에서 로컬로 provider secret을 다시 내려주는 흐름은 기본 금지한다. 예리 AI 생성을 서버로 옮겨 필요 자체를 제거한다.

## 즉시 안정화 패치

Already patched locally and no-paid smoke checked:

- Blank local settings fields preserve existing provider keys.
- Web-requested local security settings save only Naver/local settings.
- Accidental provider clear markers are repaired on load.
- Single-instance `open_settings` request signaling is restored.
- Web `openLocalSettings` waits for command completion/timeout and auto-submits an operational error report on timeout.

No-paid verification passed:

- Python compile: `app.py`, `split_version/app.py`, `local_agent/runtime.py`, `local_agent/single_instance.py`, `web_agent/client.py`
- Server syntax: `node --check oracle/aimax-reports-api/server.js`
- Web app script syntax: `APP_HTML_SCRIPT_SYNTAX_OK`
- `LOCAL_SETTINGS_PRESERVE_SECRETS_OK`
- `USER_SECRETS_SMOKE_OK`
- `YUNMI_ACCESS_GATE_SMOKE_OK`
- `LOCAL_SECRET_IMPORT_SMOKE_OK`
- `headless_agent_polling_smoke.py` with mock jobs and no Naver/API calls

## 재설계 단계

### Phase 0: 운영 Freeze

Purpose: 더 이상 신규 직원/기능을 섞어 넣지 않는다.
Scope: 송이/윤미/블로그팀 안정화 외 신규 기능 중단.
Deliverable: 운영 freeze 공지, 오류보고 신규분류, 배포 기준 고정.
Verification: 신규 feature flag가 기본 off이고, admin/user 화면에서 planned 직원이 실행 가능처럼 보이지 않는다.

### Phase 1: Emergency Hotfix

Purpose: 키 삭제/설정 루프/오류 미보고를 멈춘다.
Scope: macOS/Windows local agent rebuild, web static deploy, version gate.
Deliverable: macOS next version, Windows next version, Oracle web app deploy.
Verification: no-paid smoke matrix plus 실제 설치 후 local settings save/open check.

### Phase 2: Catalog Contract

Purpose: 직원이 반쪽으로 추가되는 것을 막는다.
Scope: server worker registry를 유일한 source of truth로 정리한다.
Deliverable: worker contract schema, admin/user UI generated from catalog, contract smoke.
Verification: 모든 worker는 `staff_code`, `execution_model`, `product`, `visibility`, `job_kind/module_key`, `required_settings`, `test_plan`을 가진다.

### Phase 3: Secret Contract

Purpose: 사용자가 키 저장 위치를 헷갈리지 않게 한다.
Scope: 웹 provider secrets canonical, 로컬 Naver-only, import-only migration.
Deliverable: settings UX split, provider status API, migration notice.
Verification: blank save cannot delete keys, local settings cannot mutate provider secrets, web secrets never leak raw values.

### Phase 4: Yeri Pipeline Split

Purpose: 블로그 실패율의 키/생성 계열을 줄인다.
Scope: server-side text/image generation, local-agent editor insertion.
Deliverable: job payload contains generated sanitized draft package; local agent inserts/saves only.
Verification: mock provider + mock editor E2E; no real paid AI/Naver publish in CI.

### Phase 5: Cross-Platform Release Gate

Purpose: macOS/Windows 빌드 드리프트를 줄인다.
Scope: build artifact contract, version API contract, smoke output required before deploy.
Deliverable: release checklist and handoff package for both OSes.
Verification: Windows and macOS each return signed completion report with smoke outputs before Oracle version bump.

## Mac / Server 해야 할 일

1. Emergency hotfix source를 macOS build에 반영한다.
2. Web static `openLocalSettings` timeout/report change를 Oracle에 배포한다.
3. macOS installed app smoke:
   - version
   - login/connect
   - local settings open/save
   - provider keys not cleared
   - mock headless job polling
4. worker catalog contract design을 server에서 시작한다.
5. Yeri server-generation split design을 별도 브랜치/phase로 진행한다.

## Windows 해야 할 일

1. Emergency hotfix source를 Windows vNext로 rebuild한다.
2. Windows installed smoke:
   - version
   - protocol connect/open-settings
   - local settings save does not clear provider keys
   - IME/password input guard
   - mock headless job polling
   - no-paid editor contract smoke
3. Windows completion report must include SHA-256, smoke output, installer path, and whether Songi/Yunmi were affected.
4. Do not implement Songi as local-agent-required.

## 사용자 커뮤니케이션 방향

짧고 정직하게 말한다.

- 최근 업데이트에서 설정 저장 방식이 바뀌며 일부 환경에서 AI/API 키가 비어 보이거나 작업이 멈출 수 있었다.
- 새 업데이트는 기존 키를 지우지 않도록 보강하고, 설정 창이 오래 걸리면 자동으로 오류 보고되게 한다.
- 블로그팀은 네이버 브라우저 조작 때문에 실행기가 필요하지만, 앞으로 AI/API 키 관리는 웹 설정 중심으로 단순화한다.
