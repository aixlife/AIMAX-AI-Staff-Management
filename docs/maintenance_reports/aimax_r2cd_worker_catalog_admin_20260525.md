# AIMAX R2-C/D Worker Catalog Admin

> 작성: 2026-05-25 00:30 KST  
> 상태: Mac/server 구현 완료, Oracle web 배포 완료, Windows 사용자 앱/실행기 검증 PASS  
> 범위: 웹 카탈로그 fallback 축소, admin 직원 카탈로그 표시 개선. 유료 API, Apify, Naver 저장/발행 테스트 없음.

## 목적

R2-A/B에서 송이/예리/현주 작업 계약을 맞춘 뒤, R2-C/D는 운영 화면과 사용자 웹앱이 같은 서버 카탈로그를 더 강하게 기준으로 삼도록 정리했다.

이번 작업의 목표는 두 가지다.

- 사용자 웹앱: `/api/workers`를 받은 뒤에는 서버가 내려준 직원/작업만 남긴다.
- admin: `/api/admin/catalog`로 받은 직원, 실행 방식, 작업 연결 상태를 운영자가 바로 볼 수 있게 한다.

## 변경 요약

### Server

- `adminProductCatalog()`에서 송이 상품의 `job_kinds`에 `songi_research`를 연결.
- `__catalogTest.adminProductCatalog`를 export해 product catalog와 worker/job catalog를 함께 smoke 검증 가능하게 함.

### Web App

- `applyWorkerCatalog()`에서 서버 catalog 수신 후:
  - 서버에 없는 fallback 직원은 제거.
  - 서버에 없는 fallback job kind는 제거.
  - 선택 중인 직원/작업이 제거되면 빈 값으로 초기화해 다음 렌더에서 유효한 항목으로 재선택.
- `/api/workers` 실패 시에만 기존 fallback을 유지한다.

### Admin

- 구매자 운영 탭에 `직원 카탈로그` 섹션 추가.
- `/api/admin/catalog` 응답의 `workers`, `job_kinds`를 state에 보관.
- 직원별로 아래 상태를 표시:
  - 직원명/역할
  - `사용 가능`, `베타`, `설정 필요`
  - `로컬 실행기`, `웹 실행`, `준비 중`
  - 상품, API mode, 큐 사용 여부
  - 연결된 job kind

## 검증

로컬 no-paid 검증:

```text
node --check oracle/aimax-reports-api/server.js
node --check scripts/smoke_worker_catalog_contract.mjs
node scripts/smoke_worker_catalog_contract.mjs
WORKER_CATALOG_CONTRACT_SMOKE_OK

node scripts/smoke_json_storage_safety.mjs
JSON_STORAGE_SAFETY_SMOKE_OK

python -m py_compile app.py split_version/app.py local_agent/runtime.py web_agent/client.py

oracle/aimax-reports-api/static/app.html SCRIPT_OK
oracle/aimax-reports-api/static/admin.html SCRIPT_OK
USER_SECRETS_SMOKE_OK
LOCAL_SECRET_IMPORT_SMOKE_OK
APIFY_LOCAL_READINESS_SMOKE_OK
YUNMI_ACCESS_GATE_SMOKE_OK
YUNMI_ALPHA_SMOKE_OK
YUNMI_PAID_READY_SMOKE_OK
JOB_PLATFORM_TARGETING_SMOKE_OK
```

`scripts/smoke_worker_catalog_contract.mjs`에 추가 확인:

- `songi_research`가 `JOB_KINDS`에 있음.
- 송이 worker가 `songi_research`를 가리킴.
- 송이 job kind는 `api_mode=research_api`, `queue=false`.
- `adminProductCatalog().songi.job_kinds`가 `songi_research`를 포함.
- product catalog의 모든 `job_kinds`가 실제 `JOB_KINDS`에 존재.

## 배포

Oracle web 배포 완료:

- 배포 리포트: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260525-002511.md`
- 원격 백업: `/home/ubuntu/aimax-backups/20260525-002511`
- 서비스: `aimax-reports-api.service active`

배포 SHA:

```text
server.js  51f5dc6152478cd174f92f3691727818e7647179706579d8acd94c0fb717684d
app.html   ec5474d7163eb800bb862dc894fa014993a74ed8cbff7216bb0a2ba46228d862
admin.html c483c12c44d071773bb3cbf29c61ed741b6a51c2729e7491ab134b9630ec52f0
```

운영 no-paid 확인:

```text
GET https://api.aimax.ai.kr/api/reports/health
ok=true
storage.ok=true
checked_files=10
issues=[]

GET https://api.aimax.ai.kr/api/workers
catalog_version=1
songi_research execution=web_module api_mode=research_api queue=false
yeri_write execution=local_agent api_mode=job_api queue=true
hyunju_find execution=local_agent api_mode=job_api queue=true

GET https://api.aimax.ai.kr/app
200 text/html; charset=utf-8

GET https://api.aimax.ai.kr/admin
200 text/html; charset=utf-8
HTML markers: 직원 카탈로그, catalogSummary, workerCatalogGrid
```

관리자 인증이 필요한 `/api/admin/catalog` live 응답은 이 Mac 세션에서 관리자 비밀번호를 사용하지 않고 확인하지 않았다. 대신 서버-side catalog contract smoke와 admin HTML marker를 확인했고, Windows 쪽에 운영자 세션 가능 시 실제 admin 화면 확인을 요청한다.

## Windows 검증 결과

Windows Codex 검증 결과: `PASS` with admin-auth caveat

반환 파일:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-25-r2cd-worker-catalog-admin/WINDOWS_RESULT_20260525_r2cd_worker_catalog_admin.md`
- `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/handoffs/2026-05-25-r2cd-worker-catalog-admin/WINDOWS_RESULT_20260525_r2cd_worker_catalog_admin.md`

확인된 내용:

- Windows 실행기 `v1.0.17` 연결 정상.
- `/app` HTTP 200, 핵심 마커 `AI/API 연결`, `오류 보고`, `송이`, `윤미`, `예리`, `현주` 확인.
- `/api/agent/status` 반복 확인 결과 `connected=true`, `status=connected`, active stuck job 없음.
- `/api/version?platform=windows&current=v1.0.17`: `update_required=false`, `update_available=false`.
- `/api/workers`:
  - `catalog_version=1`, `worker_count=7`, `job_kind_count=4`.
  - `songi_research`: `execution=web_module`, `api_mode=research_api`, `queue=false`.
  - `yeri_write`: `execution=local_agent`, `api_mode=job_api`, `queue=true`.
  - `hyunju_find`: `execution=local_agent`, `api_mode=job_api`, `queue=true`.
  - `yunmi_script`: `execution=web_module`, `api_mode=job_api`, `queue=true`.
  - 나경/현성/상수는 `planned`, `needs_setup`이며 ready 직원처럼 노출되지 않음.
- `/admin` HTTP 200, HTML에 `직원 카탈로그`, `catalogSummary`, `workerCatalogGrid`, `구매자 운영` 마커 존재.
- 유료 AI, Apify, Naver 저장/발행, installer rebuild 없음.

제한:

- Windows Codex 세션에는 admin 인증 세션이 없어 `/api/admin/me`, `/api/admin/catalog`는 `401 unauthorized`.
- 따라서 admin HTML 배포와 렌더 코드 마커는 확인됐지만, 관리자 로그인 후 실제 요약 문구 `7명 · 작업 4개 · 로컬 2 · 웹 2` 렌더는 운영자/admin 세션에서 한 번 더 확인해야 한다.

## 다음 단계

R2-C/D는 사용자 앱/실행기/worker catalog 기준으로 닫을 수 있다. 단, admin authenticated catalog render는 관리자 세션에서 수동 확인 항목으로 남긴다.

다음 후보:

- R2-E: 준비 중 직원의 사용자 노출 정책 결정. 숨김/준비 중 표시가 UX와 운영상 맞는지 AI Council 후보.
- R3: 예리 hybrid 안정화 설계 시작.
- R3 전 gate: 현재 오류 보고 중 카탈로그/실행기/설정 관련 신규 회귀가 없는지 admin에서 확인.
