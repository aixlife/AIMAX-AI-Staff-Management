아래 Syncthing 폴더의 최신 handoff 문서를 먼저 읽고 Windows 작업을 진행해주세요.

Syncthing 폴더:
`20_Deploy-To-Windows/2026-05-23-yunmi-paid-ready/`

작업 목표:
Phase 3 `Yunmi Paid-Ready Beta`의 web/server payload를 Windows 설치본에 반영하고 검증합니다. 이번 단계는 실제 유료 AI 호출을 실행하지 않고, 윤미 `AI 베타 준비` 모드의 비용 확인, `confirm_paid`, `request_id`/idempotency, mocked paid path, 오류 보고 진단 payload를 검증하는 작업입니다.

중요 규칙:
- Syncthing 공유 폴더 안에서 직접 빌드하지 말고, `aimax-yunmi-paid-ready-source-20260523.zip`을 Windows 로컬 작업 폴더로 복사한 뒤 풀어서 작업하세요.
- `.env`, passphrase, 실제 API key, 비밀번호, 쿠키, 세션 토큰, signed URL은 Syncthing에 넣지 마세요.
- 유료 Gemini/OpenAI/Claude/Apify 호출을 실행하지 마세요. 검증은 fake key와 no-paid/mock smoke만 사용하세요.
- 실제 Naver 발행/임시저장/브라우저 세션 테스트도 하지 마세요.

반영해야 할 핵심 contract:
- 윤미 기본 모드: `no_paid_alpha`
- 윤미 AI 베타 준비 모드: payload `mode: "ai_beta"`, `confirm_paid: true`, `request_id`, `ai_model`
- 확인 누락 시 서버 오류: `yunmi_paid_confirmation_required`
- provider key 누락 시 서버 오류: `yunmi_ai_key_missing`
- 같은 `request_id` 재요청 시 기존 job 반환
- 현재 결과 mode는 `paid_ready_mock`, `paid_call.executed`는 `false`
- 오류 보고에는 raw key 없이 `failed_stage`, `request_id`, `idempotency_key`, provider/model, paid call 실행 여부만 포함

검증:
1. `node --check oracle/aimax-reports-api/server.js`
2. `node --check scripts/smoke_yunmi_alpha.mjs`
3. app HTML script syntax check
4. `node scripts/smoke_yunmi_alpha.mjs`
5. 가능하면 Phase 1/2 smoke도 재실행하세요.
   - `node scripts/smoke_local_secret_import.mjs`
   - `node scripts/smoke_apify_local_readiness.mjs`
   - `node scripts/smoke_user_secrets.mjs`
6. Windows 패키징을 수행했다면 frozen payload syntax check도 실행하세요.

완료 후 Syncthing 폴더에 `WINDOWS_RESULT_20260523_yunmi_paid_ready.md`를 만들어 아래를 적어주세요.
- 반영한 파일 목록
- 실행한 검증 명령과 결과
- 패키징/설치본 생성 여부, 파일명, 크기, SHA256
- blocker가 있으면 재현 단계와 Mac/server 쪽 요청사항
