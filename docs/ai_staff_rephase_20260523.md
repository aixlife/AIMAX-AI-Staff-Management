# AIMAX AI Staff Re-Phase 20260523

작성일: 2026-05-23 KST

## 한 줄 결론

윤미/송이 다음 기능을 더 붙이기 전에 `AI/API 연결`의 기존 로컬 키 가져오기 브릿지를 선행 게이트로 추가한다. 이 기능은 Windows 사용자가 핵심 대상이므로 Mac/server/web만으로 완료 처리하지 않는다.

## 초기 확인

- 웹 `AI/API 연결`에는 저장/삭제만 있고 가져오기 버튼은 없다.
- 웹 안내 팝업에는 `AI/API 연결 열기`, `나중에 하기`만 있다.
- 서버 `/api/agent/commands`는 현재 `open_settings`만 허용한다.
- Mac 실행기와 Windows 실행기는 `open_settings` 외 command를 지원하지 않는 구조다.
- 로컬 실행기는 `gemini_api_key`, `claude_api_key`, `openai_api_key`, `apify_api_token`을 읽을 수 있지만 웹 보안 저장소로 업로드하는 contract가 없다.
- 따라서 “팝업에서 원하는 사용자가 바로 기존 실행기 키를 가져오기”는 Phase 1 전에는 동작하지 않았다.

## Phase 0. Fast Boot And Yunmi Alpha

목적:
- 새 세션 시작 비용을 줄이고, 윤미를 내부 알파로 실제 작업 탭에 올린다.

범위:
- `AGENTS.md` fast boot 규칙 추가
- 윤미 `web_module` / `yunmi_script` no-paid alpha
- A/B/C 스크립트 초안 생성, 결과 복사

산출물:
- 윤미 작업 폼
- no-paid 윤미 생성 엔진
- `scripts/smoke_yunmi_alpha.mjs`

검증 기준:
- `YUNMI_ALPHA_SMOKE_OK`
- 서버/app 문법 체크 통과
- paid AI/API 호출 없음

상태:
- 완료. 운영 배포는 별도 판단.

## Phase 1. AI/API Local Key Import Bridge

목적:
- 기존 Mac/Windows 실행기 로컬 설정에 저장된 provider API keys를 사용자가 명시적으로 웹 보안 저장소로 옮길 수 있게 한다.
- “로컬에 이미 키 넣었는데 왜 웹에서 또 필요하냐” 문제를 줄인다.

분류:
- Songi/Yunmi provider key flow는 `web-first`.
- Blog Team Naver automation은 계속 `local-agent-required`.
- 가져오기 기능은 `hybrid bridge`: 웹에서 요청하고 로컬 실행기가 로컬 provider key만 읽어 웹 보안 저장소로 업로드한다.

범위:
- 웹 안내 팝업에 `기존 실행기 키 가져오기` 버튼 추가
- 설정 탭 `AI/API 연결`에도 같은 가져오기 버튼 추가
- 서버 command type 추가
  - one-click `import_local_provider_secrets`
  - command result/status schema 추가
- 실행기 command 처리 추가
  - Mac `app.py`, `split_version/app.py`, `local_agent/runtime.py`
  - Windows 동일 contract 반영
- 가져오기 대상
  - Gemini API Key
  - Apify API Token
  - OpenAI API Key
  - Claude API Key
- 제외 대상
  - Naver password
  - cookies
  - browser profile/session
  - web session token
  - signed URLs, private logs

권장 UX:
- 팝업 버튼: `기존 실행기 키 가져오기`
- 클릭 시 짧은 확인 모달:
  - “이 PC 실행기에 저장된 AI/API 키만 웹 보안 저장소로 복사합니다.”
  - “네이버 비밀번호와 브라우저 세션은 옮기지 않습니다.”
  - 기본은 발견된 provider keys 전체 가져오기
  - 고급 옵션으로 provider별 체크 가능
- 로컬 실행기가 없거나 오래되면:
  - “실행기 업데이트 후 가져오기 가능”
  - fallback: 사용자가 직접 웹 입력

산출물:
- 웹 UI 버튼/상태 표시
- 서버 command/result schema
- 로컬 실행기 provider key import handler
- Windows handoff 및 copy-paste prompt
- no-paid smoke tests

검증 기준:
- fake local provider keys를 웹 보안 저장소로 import한다.
- 선택하지 않은 provider는 import하지 않는다.
- raw key가 command log, browser DOM, error report, stdout, Shared-Bridge에 남지 않는다.
- Naver password/cookies/profile/session은 전송되지 않는다.
- 기존 `/api/user/secrets/:provider` status/delete/replace가 계속 동작한다.
- old agent는 `unsupported_command` 또는 안내 상태로 안전하게 fallback한다.
- Mac smoke와 Windows smoke가 같은 schema로 통과한다.

Gate:
- 이 phase가 끝나기 전에는 Songi paid SNS 수집 베타나 윤미 paid AI 생성 베타로 넘어가지 않는다.

상태:
- Mac/server/web 구현 완료.
- no-paid smoke 통과: `LOCAL_SECRET_IMPORT_SMOKE_OK`, `USER_SECRETS_SMOKE_OK`, `APIFY_LOCAL_READINESS_SMOKE_OK`.
- Windows handoff 작성 완료: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-23-local-secret-import/`.
- Windows 실행기 반영/빌드/검증 완료. `WINDOWS_AGENT_COMMAND_POLLING_SMOKE_OK`, `LOCAL_SECRET_IMPORT_SMOKE_OK` 확인.
- Windows 설치본: `aimax-bundle-windows.exe`, size `136706723`, sha256 `4579889cef34f20a1d24423367e075551216890177a95ab6495db14b4e449303`.
- Live 서버 설치본 교체와 업데이트 메타데이터 반영은 별도 배포 단계로 남긴다.

## Phase 2. Songi Web-First Stabilization

목적:
- Songi가 로컬 실행기 없이 웹 `AI/API 연결` 기준으로 작동한다는 사용자 경험을 안정화한다.

범위:
- Apify/Gemini 저장 상태 안내
- SNS 링크가 `apify_key_missing`, `apify_local_pending`, `apify_needs_approval`로 정확히 표시되는지 확인
- 오류 보고 payload에 provider/stage/job id를 sanitized 형태로 포함

산출물:
- Songi no-paid regression smoke
- 운영 오류보고 안내 문구 정리

검증 기준:
- `USER_SECRETS_SMOKE_OK`
- `APIFY_LOCAL_READINESS_SMOKE_OK`
- no paid Apify Actor / Gemini call

상태:
- 송이 API 연결 상태가 `웹 저장됨`, `서버 연결`, `이 PC에만 있음`, `필요`로 구분되도록 보강.
- `apify_local_pending` 사용자 라벨을 웹 보안 저장 필요 기준으로 정리.
- 송이 오류 보고 payload에 `failed_stage`, `error_code`, `source_url`, `item_id`, `apify_run_id` 등 sanitized 진단 필드 추가.
- 보고서 redaction이 `API key=...`처럼 공백이 있는 표기도 가리도록 보강.
- no-paid smoke 통과: `APIFY_LOCAL_READINESS_SMOKE_OK`, `LOCAL_SECRET_IMPORT_SMOKE_OK`, `USER_SECRETS_SMOKE_OK`.

## Phase 3. Yunmi Paid-Ready Beta

목적:
- 윤미 no-paid alpha를 실제 AI 기반 beta 후보로 확장한다.

범위:
- paid AI 모델/비용 확인 UI
- idempotency/request id
- 자동 유료 재시도 금지
- 실패 시 오류 보고 연결
- 저장/수정/복사 흐름 보강

산출물:
- 윤미 AI 생성 API
- 비용 확인 모달
- generation result schema

검증 기준:
- confirm 없이 paid call이 실행되지 않는다.
- mocked paid path가 통과한다.
- 실제 paid call은 provider/model/action/예상비용 승인 후 1회만 실행한다.

상태:
- Mac/server/web 구현 완료.
- 실제 사용자 공개는 allowlist로 제한한다. 기본 허용 대상은 `demo@aimax.ai.kr`, `AIMAX Demo`, `메이크패밀리 1`, `메이크패밀리 2`이며 일반 bundle 사용자는 `/api/workers`, 작업 생성, 기존 윤미 작업 목록에서 윤미가 숨겨진다.
- 운영자가 전체 공개 테스트를 해야 할 때만 `AIMAX_YUNMI_PUBLIC_ENABLED=1`로 override할 수 있다.
- Admin catalog에는 윤미 feature flag/허용 기본 목록을 반환하고, 구매자 목록에는 허용 사용자만 `윤미 허용` pill을 표시한다. Admin 오류 보고/리포트는 기존 공통 흐름으로 윤미 보고를 받는다.
- 기본 `no_paid_alpha`는 유지하고, `AI 베타 준비` 모드에서만 비용 확인과 `confirm_paid`를 요구한다.
- `request_id`/`idempotency_key`로 중복 요청 시 기존 job을 반환한다.
- provider key가 없으면 `yunmi_ai_key_missing`으로 차단한다.
- 현재 베타 검증 경로는 `paid_ready_mock`이며 실제 유료 AI 호출은 실행하지 않는다.
- 윤미 실패 job에서 웹 오류 보고로 `failed_stage`, `request_id`, `idempotency_key`, provider/model, paid call 실행 여부를 sanitized 전송한다.
- no-paid/access smoke 통과: `YUNMI_ACCESS_GATE_SMOKE_OK`, `YUNMI_ALPHA_SMOKE_OK`, `YUNMI_PAID_READY_SMOKE_OK`, `LOCAL_SECRET_IMPORT_SMOKE_OK`, `APIFY_LOCAL_READINESS_SMOKE_OK`, `USER_SECRETS_SMOKE_OK`.
- Windows rebuild/검증 완료. `YUNMI_ALPHA_SMOKE_OK`, `YUNMI_PAID_READY_SMOKE_OK`, `LOCAL_SECRET_IMPORT_SMOKE_OK` 확인.
- Windows 설치본: `aimax-bundle-windows.exe`, size `136638187`, sha256 `1aa21356ac425e1eb0588ca4c6fa6e32b29b3f2bf81b4df73a0f08346289bb46`.
- Windows release ZIP: `AIMAX-yunmi-paid-ready-windows-20260523.zip`, size `181692770`, sha256 `4711f6a081a33eacfb694385476dbe81b5065a38cd55d93e6ebcc20400fc5418`.
- Windows에서 확인한 smoke portability 보강을 Mac source의 `scripts/smoke_yunmi_alpha.mjs`에도 반영했다.
- Live 서버 설치본 교체와 업데이트 메타데이터 반영은 별도 배포 단계로 남긴다.

## Phase 4. Windows Release Lane

목적:
- Phase 1~3 중 Windows 실행기 변경이 필요한 내용을 설치본으로 반영한다.

범위:
- Windows local command handler
- local settings wording
- updater/download regression
- installer rebuild and verification

산출물:
- Syncthing handoff
- `WINDOWS_AI_COPYPASTE_PROMPT_YYYYMMDD_*.md`
- rebuilt Windows installer when needed

검증 기준:
- Windows command smoke 통과
- no raw key in logs/reports
- old agent fallback 확인
- installer hash/size 기록
- no paid API/Apify/Naver publish tests

상태:
- Phase 1 local key import Windows installer rebuilt/verified.
- Phase 3 Yunmi paid-ready Windows installer rebuilt/verified.
- Windows-side checks confirmed no paid API/Apify/Naver publish tests were run.
- Live Oracle download replacement and update metadata remain an explicit deployment gate, not completed in this phase note.

## Phase 5. Next Staff Expansion

목적:
- provider key friction을 해결한 뒤 현성/상수/나경 순서로 확장한다.

범위:
- 현성: 운영 PM 보드
- 상수: 관리자/샘플 데이터 중심 회계 베타
- 나경: local_app 다운로드/버전/상태 표시

검증 기준:
- 각 직원은 시작 전에 `web-first`, `local-agent-required`, `hybrid`를 명확히 판정한다.
- 실패는 기존 웹 오류 보고 흐름으로 sanitized 보고된다.
