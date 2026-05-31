# AIMAX R2 Worker Registry SSOT

> 작성: 2026-05-24 20:02 KST  
> 상태: Mac/server 구현 완료, Oracle web 배포 완료, Windows 검증 PASS  
> 범위: 직원/작업 카탈로그 계약 정리. 유료 API, Apify, Naver 저장/발행 테스트 없음.

## 목적

R2의 1차 목표는 직원 목록과 작업 종류가 서버와 웹앱에서 서로 다르게 해석되는 문제를 줄이는 것이다.

특히 송이는 `web_module` 직원인데도 `songi_research`가 서버 `JOB_KINDS`에 없어서 웹 화면과 서버 계약이 어긋날 수 있었다. 이번 작업은 송이를 서버 카탈로그에 등록하되, 예리/현주처럼 로컬 실행기 큐로 들어가지 않도록 명확히 분리했다.

## 변경 요약

- `server.js`
  - 송이 직원 `jobKind`를 `songi_research`로 연결.
  - `JOB_KINDS.songi_research` 추가.
  - `songi_research`는 `execution=web_module`, `apiMode=research_api`, `queue=false`로 정의.
  - `yunmi_script`에 `apiMode=job_api` 계약값 추가.
  - `/api/workers`의 public job kind 응답에 `execution`, `api_mode`, `queue` 포함.
  - `/api/jobs`로 `queue=false` 작업이 들어오면 `400 job_kind_uses_module_api`로 차단.
  - `workerCatalogContractIssues()`와 `__catalogTest`를 추가해 서버 내부 카탈로그 계약 검증 가능하게 함.

- `static/app.html`
  - `applyWorkerCatalog()`가 서버에서 내려온 job kind를 웹 fallback에 없더라도 병합하도록 수정.
  - 서버 catalog가 `execution`, `api_mode`, `queue` 값을 내려주면 웹 상태에도 반영.

- `scripts/smoke_worker_catalog_contract.mjs`
  - 서버 `WORKERS`, `JOB_KINDS`, 웹 `jobKinds` fallback의 계약 불일치를 검출.
  - 송이 `research_api`/`queue=false`, 윤미 `web_module`, 서버-웹 job kind 누락 여부를 확인.

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

APP_HTML_SCRIPT_SYNTAX_OK
USER_SECRETS_SMOKE_OK
LOCAL_SECRET_IMPORT_SMOKE_OK
APIFY_LOCAL_READINESS_SMOKE_OK
YUNMI_ALPHA_SMOKE_OK
YUNMI_PAID_READY_SMOKE_OK
YUNMI_ACCESS_GATE_SMOKE_OK
JOB_PLATFORM_TARGETING_SMOKE_OK
```

참고: 일부 Node smoke는 로컬 포트를 열기 때문에 샌드박스에서 `listen EPERM`으로 한 번 막혔고, 실제 로컬 포트 권한으로 재실행해 통과했다.

## 배포

Oracle web 배포 완료:

- 배포 리포트: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/deployments/oracle-deploy-20260524-195946.md`
- 원격 백업: `/home/ubuntu/aimax-backups/20260524-195946`
- 서비스: `aimax-reports-api.service active`

배포 SHA:

```text
server.js  5ca187e83d928757b6ac6e7b783581b29febe94a14860ff050a19a58cba4a7da
app.html   347e67065824f09cecbafa691506ee5f53072560eaa9a1b014ab896f7bcdbb7b
admin.html 154971b38bebcb3fe827dc08eb2907dbf05d740695985f6c1032c942f5e0533e
```

운영 no-paid 확인:

```text
GET https://api.aimax.ai.kr/api/reports/health
ok=true
storage.ok=true
checked_files=10
issues=[]

GET https://api.aimax.ai.kr/api/version?current=v1.0.15&platform=macos
latest_version=v1.0.10
min_version=v1.0.10
update_available=false

GET https://api.aimax.ai.kr/api/version?current=v1.0.17&platform=windows
latest_version=v1.0.17
min_version=v1.0.17
update_available=false

GET https://api.aimax.ai.kr/api/workers
workers includes songi_data_research
job_kinds includes songi_research execution=web_module api_mode=research_api queue=false

GET https://api.aimax.ai.kr/app
200 text/html; charset=utf-8

GET https://api.aimax.ai.kr/admin
200 text/html; charset=utf-8
```

`/api/version`을 플랫폼/현재 버전 없이 호출하면 기본값 `v1.0.2`가 반환될 수 있다. 실제 웹앱 흐름은 `current`와 `platform`을 붙여 호출하므로 위 플랫폼별 결과를 기준으로 판단한다.

## Windows 검증 결과

Windows Codex 검증 결과: `PASS`

반환 파일:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-24-r2-worker-registry-ssot/WINDOWS_RESULT_20260524_r2_worker_registry_ssot.md`
- `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/handoffs/2026-05-24-r2-worker-registry-ssot/WINDOWS_RESULT_20260524_r2_worker_registry_ssot.md`

확인된 내용:

- Windows 실행기 `v1.0.17` 연결 정상.
- `/app` 운영 웹앱 `200`, 핵심 마커 `AI/API 연결`, `오류 보고`, `송이`, `윤미`, `예리`, `현주` 확인.
- `/api/workers` authenticated catalog:
  - `songi_research`: `execution=web_module`, `api_mode=research_api`, `queue=false`.
  - `yeri_write`: `execution=local_agent`, `api_mode=job_api`, `queue=true`.
  - `hyunju_find`: `execution=local_agent`, `api_mode=job_api`, `queue=true`.
  - `yunmi_script`: `execution=web_module`, worker status `beta`, local-agent-required 아님.
- `/api/jobs`로 `songi_research` 합성 guard probe 실행 시 `400 job_kind_uses_module_api`, unexpected job created `false`.
- 무한 로딩, stuck busy, Windows-only blocker 없음.
- 유료 AI, Apify, Naver 저장/발행, installer rebuild 없음.

## 다음 단계

R2-A/R2-B는 닫는다. 다음은 R2-C/R2-D로 간다.

- R2-C: 웹 fallback을 더 얇게 만들고 서버 catalog 우선 구조 강화.
- R2-D: admin에서 직원 카탈로그와 권한 상태를 더 명확하게 표시.

애매해지는 지점이 생기면 AI Council을 사용한다. 특히 "준비 중 직원 숨김 vs 표시", "송이/윤미의 web-first 정책", "future SQLite schema와 catalog 구조 충돌"은 Council에 넘길 후보이다.
