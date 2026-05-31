# AIMAX R3-E 예리 최소 실사용 테스트 기준

작성: 2026-05-25

## 목적

예리 Hybrid가 실제 사용자 관점에서 쓸 수 있는지 확인한다.

이번 테스트는 "짧은 글 + 이미지 1장 + 원하는 위치 삽입"만 확인하는 최소 실사용 검증이다. 고객 계정, 고객 네이버 계정, 대량 생성, 자동 반복은 사용하지 않는다.

## 현재 상태

- R3-C claim flag: 운영 서버 ON
- R3-D Windows v1.0.19 reconnect hotfix: 배포 및 Windows post-deploy pass
- 서버 유료 글 생성 flag: 아직 OFF
- 새 보호장치: Mac/server 코드에 추가 완료

## 유료 테스트 허용 기준

유료 호출은 아래 범위 안에서만 허용한다.

- 테스트 계정: 안전한 비고객 AIMAX 계정 1개
- 네이버 계정: 테스트/검증용 계정만 사용
- 글 길이: `word_count <= 500`
- 이미지 수: `image_count <= 1`
- 서버 글 생성 모델: `gemini-2.5-flash`
- 이미지 생성: Gemini 또는 OpenAI 중 로컬 실행기에 설정된 1개 provider
- 자동 재시도: 금지
- 동일 요청 중복 제출: 금지
- 실패 후 재시도: 기존 job/request 상태 먼저 확인 후 대표님 승인 필요
- Naver 발행: 별도 승인 전까지 금지
- 기본 목표: 네이버 에디터에 입력 후 임시저장 또는 발행 직전 화면 확인

현재 AIMAX 앱 내 비용표 기준으로 예상 비용은 Gemini Flash 짧은 글 1회 + 이미지 1장 기준 약 100원 미만이다. 운영상 테스트 1회 상한은 500원으로 둔다.

## 서버 보호장치

새 env:

```text
AIMAX_YERI_SERVER_GENERATION_ALLOWED_USERS=<test-account-email-or-user-id>
AIMAX_YERI_SERVER_GENERATION_REAL_TEST_ONLY=1
AIMAX_YERI_SERVER_GENERATION_REAL_TEST_MAX_WORD_COUNT=500
AIMAX_YERI_SERVER_GENERATION_REAL_TEST_MAX_IMAGE_COUNT=1
```

동작:

- allowlist에 없는 사용자는 서버 유료 글 생성을 타지 않고 기존 로컬 대기열로 간다.
- allowlist 사용자도 `confirm_paid=true` 없이는 서버 글 생성이 거부된다.
- real test 모드에서 글 길이/이미지 수 제한을 넘기면 `yeri_real_test_limit_exceeded`로 거부된다.
- 서버 글 생성 실패 시 `failed_stage=content_generation`으로 남기고 자동 재시도하지 않는다.

## 단계별 게이트

### Gate 1: no-paid 보호장치 검증

완료 기준:

- `YERI_REAL_TEST_GUARD_SMOKE_OK`
- 기존 R3 스모크 모두 pass
- 유료 API, Apify, Naver mutation 없음

### Gate 2: Windows 동일 검증

완료 기준:

- Windows Codex가 같은 소스에서 `smoke_yeri_real_test_guard.mjs`를 실행
- 기존 R3 스모크와 설치본 연결 상태 유지
- 유료 API, Apify, Naver mutation 없음

### Gate 3: 서버 allowlist 배포

완료 기준:

- 운영 서버에 real-test env만 추가
- `AIMAX_YERI_SERVER_GENERATION_ENABLED`는 대표님 승인 전까지 OFF
- health/version API 정상

### Gate 4: 최소 유료 E2E

대표님 별도 승인 후 진행한다.

입력 기준:

```json
{
  "kind": "yeri_write",
  "confirm_paid": true,
  "payload": {
    "keywords": ["AIMAX 예리 이미지 위치 테스트"],
    "ai_model": "gemini-2.5-flash",
    "word_count": 300,
    "image_count": 1,
    "style_id": "info"
  }
}
```

확인 기준:

- 서버가 `generating -> ready_for_publish`로 전환
- artifact에 제목, 본문, `[이미지]` 1개가 있음
- Mac 또는 Windows 설치 실행기가 job을 claim
- 네이버 에디터에 제목/본문이 입력됨
- 이미지 1장이 `[이미지]` 위치에 대응되는 지점에 들어감
- 저장/발행은 대표님 승인 범위에 맞춘다
- 결과 보고에 job id, failed_stage, sanitized diagnostics 포함
- raw key, password, signed URL 없음

## 이번 변경 검증 결과

Mac/server no-paid:

```text
YERI_HYBRID_FOUNDATION_SMOKE_OK
YERI_SERVER_GENERATION_MOCK_SMOKE_OK
YERI_PAID_GENERATION_GUARD_SMOKE_OK
YERI_REAL_TEST_GUARD_SMOKE_OK
YERI_READY_CLAIM_GATE_SMOKE_OK
YERI_HYBRID_RETRY_API_SMOKE_OK
YERI_LOCAL_ARTIFACT_CONTRACT_SMOKE_OK
```

변경 파일:

- `oracle/aimax-reports-api/server.js`
- `scripts/smoke_yeri_real_test_guard.mjs`

## 다음 작업

1. Windows Codex에 R3-E real-test guard 검증을 넘긴다.
2. Windows pass 후 운영 서버에 allowlist/real-test env만 배포한다.
3. 대표님이 테스트 계정과 네이버 테스트 계정 범위를 확정하면 최소 유료 E2E를 1회 진행한다.
