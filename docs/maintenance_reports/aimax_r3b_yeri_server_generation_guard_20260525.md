# AIMAX R3-B 예리 서버 생성 가드 보고서

작성: 2026-05-25

## 결론

R3-B 서버 생성 파이프라인의 첫 골격을 배포했다.

- 기본 운영 상태에서는 기존 예리 작업 흐름이 그대로 유지된다.
- `AIMAX_YERI_SERVER_GENERATION_MOCK=1`일 때만 no-paid mock artifact 생성이 동작한다.
- `AIMAX_YERI_SERVER_GENERATION_ENABLED=1`로 실제 Gemini 서버 생성을 켜더라도 `confirm_paid=true` 없이는 작업 생성/재생성이 402로 차단된다.
- `ready_for_publish` 작업은 아직 로컬 실행기가 가져가지 않는다. Mac/Windows 로컬 artifact 소비 구현 전까지 안전하게 대기 상태로만 남는다.

## 변경 파일

- `oracle/aimax-reports-api/server.js`
- `scripts/smoke_yeri_server_generation_mock.mjs`
- `scripts/smoke_yeri_paid_generation_guard.mjs`

## 구현 내용

1. 서버 생성 feature flag 추가
   - `AIMAX_YERI_SERVER_GENERATION_MOCK`
   - `AIMAX_YERI_SERVER_GENERATION_ENABLED`
   - `AIMAX_YERI_SERVER_GENERATION_MODEL`
   - `AIMAX_YERI_SERVER_GENERATION_TIMEOUT_MS`

2. 예리 artifact 생성 경로 추가
   - mock artifact 생성
   - Gemini artifact 생성 함수 추가
   - Gemini 호출 전 `confirm_paid=true` 강제
   - 사용자별 Gemini 키 조회는 기존 `getUserOrStoredSecret(userId, "gemini")` 경로 사용
   - artifact는 기존 R3-A 구조대로 `data/artifacts/{job_id}.json`에 저장

3. 작업 생성/재시도 상태 흐름 확장
   - mock/real 서버 생성 모드에서는 `queued` 대신 `generating`으로 시작
   - 생성 성공 시 `ready_for_publish`
   - 생성 실패 시 `failed`, `failed_stage=content_generation`
   - 에디터 실패 재시도는 기존처럼 artifact 재사용

4. 비용 안전장치
   - mock은 no-paid
   - 실제 Gemini 모드는 `confirm_paid=true` 없이는 시작 불가
   - smoke에서 유료 차단 경로 검증

## 검증

로컬 문법/단위:

```text
node --check oracle/aimax-reports-api/server.js
node --check scripts/smoke_yeri_server_generation_mock.mjs
node --check scripts/smoke_yeri_paid_generation_guard.mjs
node scripts/smoke_yeri_hybrid_foundation.mjs
node scripts/smoke_worker_catalog_contract.mjs
node scripts/smoke_json_storage_safety.mjs
python3 -m py_compile app.py split_version/app.py web_agent/client.py
```

로컬 HTTP smoke:

```text
YERI_SERVER_GENERATION_MOCK_SMOKE_OK
YERI_PAID_GENERATION_GUARD_SMOKE_OK
YERI_HYBRID_RETRY_API_SMOKE_OK
JOB_PLATFORM_TARGETING_SMOKE_OK
YUNMI_ACCESS_GATE_SMOKE_OK
```

## 배포

Oracle web 배포 완료.

- 배포 리포트: `docs/deployments/oracle-deploy-20260525-014442.md`
- live `server.js` sha256: `c6281f4f32c45514a2e7c3d80e71ee6ff4c15c9d5677954033b4edaed3ebe780`
- 서비스 상태: `active`
- health: `ok=true`, storage `ok=true`

## 남은 일

R3-C에서 Mac/Windows 로컬 실행기가 `ready_for_publish` artifact를 받아 글 생성 단계를 건너뛰고 네이버 입력 단계부터 실행하도록 구현해야 한다.

그 전까지 `ready_for_publish`는 의도적으로 agent claim 대상이 아니다.

## Windows 검증

Windows Codex 반환 보고서 확인 완료.

- 반환 파일: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-25-r3b-yeri-server-generation-guard/WINDOWS_RESULT_20260525_r3b_yeri_server_generation_guard.md`
- verdict: `pass`
- Windows rebuild required: `no`
- no-paid/no-mutation 준수 확인
- `YERI_SERVER_GENERATION_MOCK_SMOKE_OK`
- `YERI_PAID_GENERATION_GUARD_SMOKE_OK`
- `YERI_HYBRID_RETRY_API_SMOKE_OK`
- `JOB_PLATFORM_TARGETING_SMOKE_OK`

Windows 피드백:

- future source bundle에는 `oracle/aimax-reports-api/static/app.html`도 포함한다.
- 이유: `scripts/smoke_worker_catalog_contract.mjs`가 static app fallback 파일을 직접 읽는다.
