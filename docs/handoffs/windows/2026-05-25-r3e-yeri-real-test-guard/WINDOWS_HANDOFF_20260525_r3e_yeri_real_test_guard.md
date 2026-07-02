# Windows Handoff: R3-E Yeri Real-Test Guard

작성: 2026-05-25

## 목적

Mac/server 쪽에 추가된 예리 최소 유료 테스트 보호장치가 Windows 환경에서도 동일하게 동작하는지 no-paid로 검증한다.

이번 단계는 유료 API, Apify, Naver mutation을 절대 실행하지 않는다.

## 배경

대표님이 실제 사용자 검증을 위해 "짧은 글 + 이미지 1장" 수준의 유료 테스트를 허용했다. 다만 운영 서버의 예리 서버 생성 flag는 전역 스위치라서, 실제 유료 E2E 전에 테스트 계정 allowlist와 짧은 글/이미지 1장 제한을 먼저 넣었다.

## 변경 파일

- `oracle/aimax-reports-api/server.js`
- `scripts/smoke_yeri_real_test_guard.mjs`
- `docs/testing/aimax_r3e_yeri_minimal_real_test_criteria_20260525.md`

## 새 env

```text
AIMAX_YERI_SERVER_GENERATION_ALLOWED_USERS=<test-account-email-or-user-id>
AIMAX_YERI_SERVER_GENERATION_REAL_TEST_ONLY=1
AIMAX_YERI_SERVER_GENERATION_REAL_TEST_MAX_WORD_COUNT=500
AIMAX_YERI_SERVER_GENERATION_REAL_TEST_MAX_IMAGE_COUNT=1
```

## 검증 기준

Windows Codex가 아래를 직접 실행하고 결과를 반환한다.

```powershell
node --check oracle/aimax-reports-api/server.js
node --check scripts/smoke_yeri_real_test_guard.mjs
node scripts/smoke_yeri_real_test_guard.mjs
node scripts/smoke_yeri_paid_generation_guard.mjs
node scripts/smoke_yeri_ready_claim_gate.mjs
python scripts/smoke_yeri_local_artifact_contract.py
```

PASS 기준:

- `YERI_REAL_TEST_GUARD_SMOKE_OK`
- `YERI_PAID_GENERATION_GUARD_SMOKE_OK`
- `YERI_READY_CLAIM_GATE_SMOKE_OK`
- `YERI_LOCAL_ARTIFACT_CONTRACT_SMOKE_OK`
- allowlist 밖 사용자는 server generation이 아니라 `queued`로 남음
- allowlist 사용자도 `confirm_paid=true` 없으면 402
- `word_count > 500` 또는 `image_count > 1`이면 400 `yeri_real_test_limit_exceeded`
- 실제 Gemini/OpenAI/Claude/Apify 호출 없음
- Naver 로그인/저장/발행 없음
- 고객 계정/고객 credentials 사용 없음

## 반환 파일

공유 폴더에 아래 파일을 남긴다.

```text
WINDOWS_RESULT_20260525_r3e_yeri_real_test_guard.md
```

내용에는 반드시 포함한다.

- verdict: `pass` 또는 `blocked`
- 실행한 명령
- 주요 출력
- 차단 시 가장 좁은 원인
- 유료 API/Apify/Naver/customer credential 미사용 확인

## 다음 게이트

Windows PASS 후 Mac/server 쪽은 운영 서버에 allowlist/real-test env만 배포한다. `AIMAX_YERI_SERVER_GENERATION_ENABLED=1`은 대표님이 최소 유료 E2E를 다시 승인하기 전까지 켜지 않는다.
