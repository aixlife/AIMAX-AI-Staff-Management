# Windows Handoff: Yunmi Paid-Ready Beta

작성일: 2026-05-23 KST

## 목적

Phase 3 `Yunmi Paid-Ready Beta`의 web/server payload를 Windows 설치본에 반영하고 검증한다. 이번 단계는 실제 유료 AI 호출을 열지 않고, 비용 확인 UI, `confirm_paid`, `request_id`/idempotency, mocked paid path, 오류 보고 진단 payload를 확인하는 단계다.

## Mac/Web 변경 요약

- 윤미 기본 모드는 계속 `no_paid_alpha`다.
- 새 UI `AI 베타 준비` 모드는 예상 비용을 보여주고 확인 후에만 `confirm_paid: true`를 보낸다.
- 서버는 `mode: "ai_beta"` 요청에서 `confirm_paid`가 없으면 `yunmi_paid_confirmation_required`로 차단한다.
- provider key가 없으면 `yunmi_ai_key_missing`으로 차단한다.
- 같은 `request_id`/`idempotency_key` 요청은 기존 job을 반환한다.
- 현재 결과 모드는 `paid_ready_mock`이며 실제 Gemini/OpenAI/Claude paid call은 실행하지 않는다.
- 윤미 실패 job은 웹 오류 보고에 `failed_stage`, `request_id`, `idempotency_key`, provider/model, paid call 실행 여부를 sanitized 전송한다.

## Windows 작업 범위

1. 이 폴더의 최신 handoff 문서를 먼저 읽는다.
2. `aimax-yunmi-paid-ready-source-20260523.zip`을 Windows 로컬 작업 폴더로 복사해서 푼다.
3. Syncthing 공유 폴더 안에서 직접 빌드하지 않는다.
4. 전달된 web/server payload 변경을 Windows 소스에 반영한다.
5. Windows 설치본에 `oracle/aimax-reports-api/server.js`, `static/app.html`, `scripts/smoke_yunmi_alpha.mjs`, phase 문서 변경이 포함되는지 확인한다.
6. 유료 Gemini/OpenAI/Claude/Apify 호출은 실행하지 않는다. fake provider key와 mocked path만 사용한다.

## 전달 아티팩트

- `aimax-yunmi-paid-ready-source-20260523.zip`
- `WINDOWS_AI_COPYPASTE_PROMPT_20260523_yunmi_paid_ready.md`
- 이 handoff 문서

## 검증 기준

- `node --check oracle/aimax-reports-api/server.js`
- `node --check scripts/smoke_yunmi_alpha.mjs`
- app HTML script syntax check
- `node scripts/smoke_yunmi_alpha.mjs`
- 가능하면 기존 Phase 1/2 smoke도 재실행
  - `node scripts/smoke_local_secret_import.mjs`
  - `node scripts/smoke_apify_local_readiness.mjs`
  - `node scripts/smoke_user_secrets.mjs`
- Windows 패키징을 수행했다면 frozen payload syntax check도 실행한다.

## 반환 기대

Windows 작업 완료 후 이 Syncthing 폴더에 아래를 남긴다.

- `WINDOWS_RESULT_20260523_yunmi_paid_ready.md`
- 실행한 검증 명령과 결과
- 패키징/설치본을 만들었다면 파일명, 크기, SHA256
- blocker가 있으면 원인, 재현 단계, 필요한 Mac/server 변경 요청

## 금지

- 실제 paid Gemini/OpenAI/Claude/Apify 호출
- 실제 Naver publish/draft/browser session test
- `.env`, passphrase, 실제 API key, 비밀번호, 쿠키, session token, signed URL을 Syncthing에 저장
