# AIMAX R3-A Yeri Hybrid Foundation

작성일: 2026-05-25
상태: 완료 및 Oracle web 배포 완료

## 목적

예리 Hybrid 안정화를 바로 유료 AI 생성으로 전환하지 않고, 먼저 서버가 안전하게 다룰 수 있는 기반 계약을 만든다.

- 긴 글 본문 artifact를 `jobs.json`에 직접 넣지 않고 별도 파일로 저장
- `generating`, `ready_for_publish` 상태 계약 추가
- 실패 단계(`failed_stage`)와 재시도 횟수(`retry_count`) 기록
- 서버 재시작/중단으로 `generating` 상태가 영구 대기하지 않도록 복구
- 재시도 API의 기본 동작 준비

## 변경 파일

- `oracle/aimax-reports-api/server.js`
- `scripts/smoke_yeri_hybrid_foundation.mjs`
- `scripts/smoke_yeri_hybrid_retry_api.mjs`

## 서버 변경

### 1. Artifact 분리 저장

- 새 저장 위치: `data/artifacts/{job_id}.json`
- 새 상수: `ARTIFACTS_DIR`
- helper:
  - `safeArtifactId()`
  - `saveYeriArtifact()`
  - `loadYeriArtifact()`
  - `attachYeriArtifactToJob()`
  - `publicYeriArtifactMeta()`
  - `agentYeriArtifactPayload()`

공개 job 응답에는 본문 전문을 넣지 않고 artifact metadata만 노출한다. 실행기용 `agentJob()`에는 artifact가 있는 경우 sanitized full artifact를 실을 수 있게 준비했다.

### 2. Job 상태 계약

추가된 상태:

- `generating`
- `ready_for_publish`

단, R3-A에서는 구버전 Mac/Windows 실행기 보호를 위해 `ready_for_publish`는 아직 `/api/agent/next-job`에서 claim되지 않게 유지했다. 로컬 실행기 artifact 소비 코드가 들어간 R3-B 이후 claimable 상태를 확장한다.

### 3. 실패 단계와 재시도 기반

- `/api/agent/jobs/update`가 `failed_stage`, `failed_reason`, `retry_count`, artifact metadata를 공개 job 응답에 포함한다.
- 신규 API: `POST /api/jobs/:id/retry`
- 재시도 규칙:
  - artifact가 있고 실패 단계가 `content_generation`이 아니면 `ready_for_publish`로 복원
  - artifact가 없거나 생성 실패면 `queued`로 복원
  - 기본 재시도 제한: `AIMAX_YERI_RETRY_LIMIT` 또는 3회

### 4. generating stuck 복구

서버 시작 시 `recoverStaleGeneratingJobs()`를 실행한다.

- 기본 기준: `AIMAX_YERI_GENERATING_STALE_MS` 또는 30분
- stale `generating` job은 `failed`로 변경
- `failed_stage = content_generation`
- 사용자/지원팀이 재시도할 수 있도록 로그를 남긴다.

## 검증

로컬 no-paid 검증:

- `node --check oracle/aimax-reports-api/server.js`
- `node --check scripts/smoke_yeri_hybrid_foundation.mjs`
- `node --check scripts/smoke_yeri_hybrid_retry_api.mjs`
- `node scripts/smoke_yeri_hybrid_foundation.mjs`
- `node scripts/smoke_yeri_hybrid_retry_api.mjs`
- `node scripts/smoke_worker_catalog_contract.mjs`
- `node scripts/smoke_json_storage_safety.mjs`
- `python3 -m py_compile app.py split_version/app.py web_agent/client.py`
- `node scripts/smoke_job_platform_targeting.mjs`
- `node scripts/smoke_yunmi_access_gate.mjs`

참고: `smoke_job_platform_targeting.mjs`, `smoke_yunmi_access_gate.mjs`, `smoke_yeri_hybrid_retry_api.mjs`는 로컬 HTTP 서버 바인딩이 필요해 샌드박스 밖에서 실행했다.

Live 검증:

- Oracle deploy report: `docs/deployments/oracle-deploy-20260525-005826.md`
- remote `server.js` sha256: `79a0794163705eeaf2527d7b2eaed9cb3a5f921ba9fd9257ce65868cf79bf6dd`
- service: `aimax-reports-api.service active`
- `https://api.aimax.ai.kr/api/reports/health`: `ok: true`, storage `ok: true`
- `https://api.aimax.ai.kr/api/workers`: `ok: true`, `songi_research` remains `web_module/research_api/queue=false`

Windows 재검증:

- 1차 결과: `WINDOWS_RESULT_20260525_r3a_yeri_hybrid_foundation.md` -> `blocked`
  - 원인: Windows 로컬 작업 폴더가 R3-A source snapshot이 아니고 smoke scripts가 없었음
- 보완: sanitized source bundle 제공
  - `aimax_r3a_yeri_hybrid_foundation_source_bundle_20260525.zip`
  - SHA256: `4328cd26cbc399c15e8573d93bbc2cff08e8e3e1ad1e33ba09a621e60a79d7d7`
- 재검증 결과: `WINDOWS_RESULT_20260525_r3a_yeri_hybrid_foundation_RECHECK.md` -> `pass`
  - bundled `server.js` sha256 live hash와 일치
  - `YERI_HYBRID_FOUNDATION_SMOKE_OK`
  - `YERI_HYBRID_RETRY_API_SMOKE_OK`
  - `WORKER_CATALOG_CONTRACT_SMOKE_OK`
  - `JOB_PLATFORM_TARGETING_SMOKE_OK`
  - Windows `v1.0.17` 재빌드 불필요
  - queued job claim smoke pass
  - `ready_for_publish` non-claim smoke pass

Windows가 발견한 test harness 이식성 이슈:

- `scripts/smoke_yeri_hybrid_retry_api.mjs`
- `scripts/smoke_job_platform_targeting.mjs`

두 스크립트가 native Windows에서 `new URL(import.meta.url).pathname` 경로 계산으로 child process cwd를 잘못 만들 수 있었다. 제품 코드 문제가 아니라 smoke harness 이슈이며, upstream에서 `fileURLToPath(import.meta.url)` 방식으로 수정했다. 같은 패턴이 있던 `scripts/smoke_local_secret_import.mjs`, `scripts/smoke_user_secrets.mjs`, `scripts/songi-local.mjs`도 함께 보강했다.

수정 후 Mac 재검증:

- `node --check` 대상 smoke/CLI scripts 통과
- `node scripts/smoke_yeri_hybrid_foundation.mjs` -> `YERI_HYBRID_FOUNDATION_SMOKE_OK`
- `node scripts/smoke_yeri_hybrid_retry_api.mjs` -> `YERI_HYBRID_RETRY_API_SMOKE_OK`
- `node scripts/smoke_job_platform_targeting.mjs` -> `JOB_PLATFORM_TARGETING_SMOKE_OK`

## No-Paid / No-Naver

- Gemini/OpenAI/Claude/Apify 유료 호출 없음
- 네이버 로그인/저장/발행 호출 없음
- 실제 글 생성 없음
- 실제 이미지 생성 없음

## 남은 작업

R3-B에서 진행:

1. 서버-side 예리 텍스트 artifact 생성 도입
2. 사용자 API 키 읽기 경로와 비용/실패 idempotency guard 연결
3. Mac 로컬 실행기 artifact 소비: AI 글 생성 생략, 네이버 입력 단계부터 시작
4. Windows 로컬 실행기 artifact 소비 동등 구현
5. R3-C에서 스마트에디터/이미지/diagnostics 강화

## Windows 영향

R3-A는 서버 web 배포만 포함한다. Windows 설치본 재빌드는 필요 없다.

Windows 재검증 결과 기존 `queued` job claim smoke와 R3-B 전 `ready_for_publish` non-claim smoke가 통과했다.

## Cross-Platform User-Journey Gate

앞으로 AIMAX 배포 판단은 다음 원칙을 따른다.

- 사용자에게 보이는 기능 변경, 로컬 실행기 변경, 설치/업데이트/다운로드 변경, 직원 실행 흐름 변경은 Mac 실사용 smoke와 Windows 실사용 smoke를 모두 통과하기 전까지 완료로 보지 않는다.
- Mac/server 작업자는 Mac에서 직접 사용자 입장 테스트를 수행하고, Windows는 shared-bridge handoff로 Windows Codex가 실제 Windows 환경에서 확인한다.
- 단순 서버 기반/계약 준비 작업은 기존 클라이언트가 새 흐름을 자동으로 밟지 않도록 호환성을 잠근 경우에만 선배포할 수 있다.
- 선배포 예외를 쓴 경우에도 즉시 Windows 회귀 확인을 요청하고, 회귀가 있으면 rollback 또는 claim gate 유지로 막는다.

R3-A는 `ready_for_publish`가 아직 agent claim 대상이 아니어서 구버전 Mac/Windows 실행기가 새 artifact 흐름을 실행하지 않는다. 따라서 서버 기반 선배포는 허용했지만, R3-B 이후 실제 artifact 소비/예리 글쓰기 사용자 흐름은 Mac/Windows 실사용 smoke 전에는 배포 완료로 판정하지 않는다.
