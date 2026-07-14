# AIMAX 전체 세션 이력 개발자 핸드오프

작성일: 2026-06-15 KST  
작성자: Codex  
목적: AIMAX 디렉토리 세션 초반부터 2026-06-15까지의 오류, 해결, 반복 이슈, 기능 추가, 운영 원칙, 다음 개발 진입점을 한 문서에 모은다.

> 이 문서는 다음 AI 개발자가 이어서 오류 수정, 신규 직원 개발, 배포, Windows/Mac 협업을 할 때 보는 압축형 정본이다. 세부 증거는 각 섹션의 참조 문서를 직접 확인한다.

## 0. 먼저 읽을 것

작업을 시작하기 전에 아래 순서로 확인한다.

1. `memory/MEMORY.md`
2. 이 문서
3. 최신 1-2개 관련 세션 로그: `/Users/aixlife/Documents/creator-os-vault/sessions/AIMAX-AI-Staff-Management/`
4. 현재 수정 대상의 배포/핸드오프 문서: `docs/deployments/`, `docs/maintenance_reports/`, `handoffs/`, `docs/windows_handoffs/`
5. 실제 운영 상태: `/health`, `/api/version`, `/api/workers`, admin 화면, 최신 installer hash

주의:

- 이 문서는 기록 기준 정리다. 운영 상태는 배포 후 바뀔 수 있으므로 반드시 live verification을 한다.
- 비밀값, API 키, Naver 계정/쿠키/세션, signed URL은 문서나 공유 브리지에 쓰지 않는다.
- paid AI, Apify, Naver 저장/발행은 명시 승인 없이 실행하지 않는다.
- 현재 로컬 worktree에는 여러 미커밋/미추적 변경이 있다. 배포 전에 `git status --short`와 대상 파일 diff를 먼저 확인한다.

## 1. 프로젝트가 변해 온 큰 흐름

초기 상태는 `NaverBlogAuto` 데스크톱 자동화 앱이었다. 핵심 문제는 Windows에서 Naver 로그인, 블로그 세션, Smart Editor iframe, PyInstaller 배포가 흔들리는 것이었다.

2026-05 중순부터 AIMAX는 "웹에서 AI 직원을 고용하고 지시하며, 로컬 실행기는 웹이 못 하는 OS/브라우저 자동화만 맡는" 구조로 전환됐다. 이 과정에서 직원 카탈로그, Cafe24 주문/온보딩, 오류 보고, Windows/Mac 실행기 배포, web-first 직원 송이/윤미, 외부 다운로드형 직원 지은이 추가됐다.

현재 제품 판단의 중심은 2026-05-30 결정이다.

- 최우선 목표: 구매자 누구나 예리/현주를 실제로 쓸 수 있게 만든다.
- 검증 기준: 내부 smoke가 아니라 실제 배포 링크에서 최신 설치 파일을 다시 다운로드하고, 설치, 로그인, 설정/연결, 작업 생성, Naver 입력, 임시저장까지 확인한다.
- 송이/윤미는 web-first라 상대적으로 안정적이다.
- 예리/현주는 local runner, Naver, 브라우저, OS 보안 정책이 얽히므로 계속 우선 관리 대상이다.

## 2. 현재 아키텍처 스냅샷

주요 구성:

- Web/API: `oracle/aimax-reports-api/server.js`
- 사용자 앱: `oracle/aimax-reports-api/static/app.html`
- Admin: `oracle/aimax-reports-api/static/admin.html`
- Mac/Windows local runner 중심: `app.py`
- runner bridge: `local_agent/runtime.py`, `web_agent/client.py`
- Naver 자동화: `posting/editor.py`, `posting/publisher.py`, `browser/session_manager.py`
- AI 생성: `content/ai_text.py`, `content/gemini_image.py`, `content/prompts.py`
- 배포: `scripts/deploy_oracle.sh`, `build.py`, `packaging/windows/`
- 운영 메모리: `memory/MEMORY.md`

역할 분리 원칙:

- Web app = 지휘 센터
- Local Agent = Naver 브라우저 조작, OS 자동화, 로컬 비밀/세션 처리
- 서버 = 직원 카탈로그, 작업 큐, 웹 API 키 저장/사용, 오류 보고, 주문/온보딩
- Windows Codex = Windows 빌드/설치/실기 검증
- Mac Codex = canonical source, Oracle 배포, Mac 검증, Windows handoff

구조적 잔여 리스크:

- `server.js`와 `app.html`이 여전히 큰 단일 파일이다.
- JSON 파일 기반 데이터 저장소가 아직 완전한 DB 구조로 이전되지 않았다.
- `app.py` 중심 runner가 여전히 크고 OS별 특수 처리가 많다.
- 배포/핸드오프 산출물이 많아 최신 정본 확인이 필요하다.

## 3. 주요 연대기

### 2026-05-06 ~ 2026-05-08: 초기 운영/온보딩 기반

- Windows/Mac installer 및 Oracle 배포가 시작됐다.
- 사용자 계정 setup link 흐름이 도입됐다.
- 임시 비밀번호 이메일 대신 1회용 비밀번호 설정 링크 방식이 더 안전하다는 결정이 남았다.
- 사용자-facing dashboard는 과거 실패 job 개수보다 현재 해야 할 행동을 보여줘야 한다는 운영 UX 원칙이 정해졌다.

### 2026-05-15: 프로젝트명과 신규 직원 운영 체계 전환

- canonical 폴더가 `/Users/aixlife/Projects/AIMAX-AI-Staff-Management`로 정리됐다.
- 신규 AI 직원 5명 운영 일정과 개발 단계가 정리됐다.
- Windows AI 개발자에게 프로젝트명 변경과 신규 직원 배포 맥락이 전달됐다.
- 신규 직원 개발은 "공통 운영 기반 + 병렬 트랙 + MVP 범위 절단" 방식으로 가기로 했다.

참조:

- `docs/ai_staff_integration_architecture_20260511.md`
- `docs/ai_staff_admin_foundation_phase_20260511.md`
- `docs/ai_staff_rollout_schedule_20260515.md`
- `handoff/WINDOWS_AI_DEVELOPER_MESSAGE_20260515_PROJECT_RENAME_STAFF_ROLLOUT.md`

### 2026-05-16: Cafe24 주문 대기열과 오류 보고 UX

추가된 기능:

- Cafe24 주문 메일을 n8n이 AIMAX API로 보내고, admin에서 주문 대기열로 관리한다.
- 운영자는 상품 보정, 계정 생성, 안내문 발송을 선택 실행한다.
- 오류 보고 후 사용자에게 접수 ID, 상태, 다음 안내 기준, 운영팀 안내문이 보이게 했다.
- admin에서 고객에게 보이는 오류 안내 문구와 상태를 수정할 수 있게 했다.

중요 결정:

- 주문 자동화는 처음부터 완전 자동 계정 생성을 하지 않고, 관리자 확인을 거치는 형태로 시작했다.
- 임시 비밀번호와 안내문 본문은 주문 대기열에 저장하지 않는다.
- n8n webhook secret은 n8n 변수로 참조하고 문서에 노출하지 않는다.

참조:

- `docs/admin_user_operations_guide.md`
- `docs/deployments/oracle-deploy-20260515-214932.md`
- `docs/deployments/oracle-deploy-20260515-200544.md`

### 2026-05-17 ~ 2026-05-19: Windows 실행기 급한 안정화

반복적으로 나온 문제:

- `aimax://agent/connect`, `open_settings`가 Windows에서 실패하거나 반복 실행됨
- Windows 패키지에 오래된 `content.ai_text`가 들어가 `measure_visible_char_count` import 실패
- split launcher와 bundle launcher가 엇갈림
- content generation 실패 원인이 API key인지 모델 payload인지 알기 어려움
- OpenAI `gpt-5.4-mini`에서 `reasoning.effort=minimal`이 400 오류를 냄

해결:

- v1.0.3: native Go launcher guard 추가
- v1.0.4: `measure_visible_char_count` 누락 해결
- v1.0.5: canonical source merge, diagnostics probe, browser/login recovery marker, single-instance lock handling
- v1.0.6: unified launcher guard, split/bundle mismatch 진단
- v1.0.7: installer file-lock/code 5, local executor timeout, provider/model/request/error 진단
- v1.0.8: OpenAI reasoning effort를 `minimal`에서 `low`로 변경
- open Windows report들은 단계별로 `waiting_user`로 이동하고 최신 업데이트 후 재시도를 안내했다.

참조:

- `docs/maintenance_reports/aimax_stabilization_phase_log_20260517.md`
- `docs/deployments/oracle-deploy-20260518-120925-windows-v105-canonical.md`
- `docs/deployments/oracle-deploy-20260518-224009.md`

### 2026-05-19 ~ 2026-05-22: 송이 MVP와 웹 AI/API 키 방향

송이 방향:

- 송이는 별도 사이드 페이지가 아니라 예리/현주처럼 "작업" 탭의 AI 직원이어야 한다.
- 첫 UX는 링크/영상 URL 중심이다.
- YouTube는 oEmbed/captionTracks/timedtext를 best-effort로 읽는다.
- general web page는 public http/https만 읽고 SSRF 방어를 유지한다.
- paid AI/API는 기본으로 쓰지 않는다.

API 키 방향:

- Gemini/OpenAI/Claude/Apify provider key는 웹 보안 저장소 기준이다.
- Naver ID/password/session/cookies는 local-only다.
- 이 둘을 같은 설정 화면에 섞으면 사용자가 "웹에 저장했는데 로컬이 못 읽는" 혼선이 반복된다.

### 2026-05-23: 아키텍처 리셋과 Cross-Environment Phase

4개 AI 검토와 운영 데이터 분석으로 근본 원인이 정리됐다.

핵심 문제:

- API 키 단절: 웹은 `user-secrets.json`, 로컬은 keyring/fallback settings를 읽어 서로 다름
- 직원 정의 이중화: server worker, job kind, app.html hardcoding이 어긋남
- 윤미 접근 제어가 하드코딩/환경변수 중심
- Mac/Windows 코드 포크와 split_version drift
- JSON file DB와 god file 구조
- 미완성 직원이 UI에 보이는 문제

운영 원칙:

- 직원 = 서버가 정의한다.
- Local app = Naver 브라우저 조작만 한다.
- UI = 지금 할 수 있는 것만 보인다.
- web-first, local-agent-required, hybrid, external-download를 명확히 나눈다.

Cross-Environment Phase:

- R0 Release Reality Check
- R1 Data Safety Hotfix
- R2 Worker Registry SSOT
- R3 OS Abstraction Bridge
- R4 Yeri Hybrid Reliability
- R5 Web-First Staff Completion
- R6 SQLite WAL Migration
- R7 Observability and Realtime

참조:

- `docs/maintenance_reports/aimax_master_handoff_20260523.md`
- `docs/maintenance_reports/aimax_cross_environment_phase_plan_20260523.md`
- `docs/maintenance_reports/aimax_current_code_independent_audit_20260523.md`
- `docs/maintenance_reports/aimax_architecture_reset_20260523.md`

### 2026-05-24 ~ 2026-05-28: R2/R3, 예리 hybrid, 실제 paid draft-save gate

진행된 일:

- worker registry/SSOT 방향을 반영하기 시작했다.
- 예리 hybrid foundation, server generation guard, local artifact consumer가 추가됐다.
- local runner가 생성 artifact를 받아 Naver 입력만 수행하도록 전환하는 기반을 만들었다.
- job delivered 후 runner가 start update를 안 보내는 문제를 잡기 위해 claim ACK, runner-start timeout watchdog, delivered-but-not-started sweep가 추가됐다.
- Windows v1.0.28 no-paid gate를 통과했고, 이후 owner 승인 하에 1회 paid visible-browser test를 실행했다.

중요 paid test:

- 2026-05-28 Windows R3-Q paid visible-browser test 통과
- 조건: demo account, production UI, Yeri, Gemini 2.5 Flash, 800자, image 1, Naver 임시저장 only, max 500 KRW, exactly one submission
- 결과: job done, Naver login/Smart Editor/title/body/image/draft save 통과, 비용 137 KRW
- Gemini image quota 429로 OpenAI image fallback이 사용됐다.

배포:

- R3-R rollout로 macOS latest/min v1.0.17, Windows latest/min v1.0.28 반영
- 이후 R3-S triage로 open report를 정리하고 stale demo report를 닫았다.

참조:

- `docs/deployments/r3p-no-paid-deploy-ready-checklist-20260527-v117-v128.md`
- `docs/deployments/r3p-paid-visible-browser-test-approval-request-20260527.md`
- `docs/deployments/oracle-deploy-20260528-r3r-v117-v128-rollout.md`
- `docs/maintenance_reports/aimax_error_report_triage_r3p_20260527.md`
- `docs/maintenance_reports/aimax_r3s_post_deploy_report_triage_20260528.md`

### 2026-05-28 ~ 2026-05-29: 송이 YouTube Discovery와 서버 fallback

추가된 기능:

- 송이 task tab이 `키워드로 찾기`, `링크로 분석`으로 분리됐다.
- public YouTube metadata discovery를 `yt-dlp --skip-download` 기반으로 수행한다.
- benchmarking card UI가 추가됐다.
- Windows media tools fallback과 on-demand media tools 방향이 정리됐다.

문제와 해결:

- macOS old runner가 `songi_youtube_discovery`를 지원하지 않아 실패했다.
- v1.0.33 hotfix에서 server `yt-dlp` fallback을 먼저 쓰고, 필요할 때만 local runner로 fallback하게 바꿨다.
- 이로써 Songi YouTube discovery는 local runner 의존을 크게 줄였다.

참조:

- `docs/deployments/oracle-deploy-20260528-songi-youtube-v131-release.md`
- `docs/deployments/oracle-deploy-20260529-v133-songi-server-fallback.md`
- `handoffs/2026-05-28-songi-youtube-discovery-v131-release/`

### 2026-05-30 ~ 2026-06-02: 실제 구매자 사용 가능성 중심 안정화

제품 목표:

- 아직 한 번도 제대로 못 써본 구매자를 위해 "예리/현주 실제 사용 가능"을 최우선으로 둔다.
- 최신 설치파일을 실제 다운로드/설치/연결해서 검증해야 한다.

6월 1일 주요 변경:

- local settings false-positive error report를 줄였다.
- 웹 `설정 > AI/API 연결`에서 provider key를 관리하고, local security settings는 Naver ID/password만 저장한다는 안내를 분명히 했다.
- Windows SmartScreen guidance modal을 다운로드 전에 보여준다.
- Windows v1.0.38: web AI/API key recognition, installer auto-close code 5, missing `local_agent.state_repair` 수정
- Windows v1.0.39: stale single-instance lock 때문에 실행기가 바로 종료되고 버전이 `-`로 보이던 문제 수정
- 직원 채용 화면 초기 `전체` 필터에서 전체 runnable catalog를 보여주도록 변경
- macOS Intel은 unsupported로 명확히 차단하고 Apple Silicon 확인 모달을 추가

6월 2일 주요 변경:

- Windows v1.0.44 required/latest 배포
- Yeri/Naver title input을 실제 title field click + keyboard/clipboard input으로 수정
- draft-save confirmation이 draft count increase/autosave state를 인정하도록 보강
- Windows live paid draft-save smoke 통과: 공개 발행/예약 없음, 임시저장만 수행
- open report 전부 `waiting_user`로 정리: `done=28`, `waiting_user=56`, `new/reviewing/working=0`, active jobs 0
- Songi `API_KEY_INVALID`를 `research_gemini_invalid_api_key`로 분류
- Yunmi가 `reference_url`을 spoken evidence로 쓰거나 URL-only script를 생성하지 못하게 수정

참조:

- `docs/maintenance_reports/aimax_error_report_triage_20260601_web_ai_local_settings.md`
- `docs/maintenance_reports/aimax_error_report_triage_20260602_v1044.md`
- `docs/deployments/oracle-deploy-20260601-193930.md`
- `docs/deployments/oracle-deploy-20260601-203609.md`
- `docs/deployments/oracle-deploy-20260602-033639.md`
- `docs/deployments/oracle-deploy-20260602-163323-api-key-yunmi-url-fix.md`

### 2026-06-03 ~ 2026-06-04: 지은, Cafe24 오분류, 텔레그램/오류 보고 확인

지은:

- `AI 오피스 지원` Windows 전용 external-download 직원으로 운영 웹에 배포됐다.
- v0.1.5에서 캡처 이미지 모자이크 기능이 배포됐다.
- Windows 전용이므로 non-Windows 환경에서는 다운로드 비활성화/안내가 필요하다.

오류 보고/텔레그램:

- 텔레그램에는 보고가 왔는데 admin에서 보이지 않는 듯한 상황을 점검했다.
- 재확인 report 4건 + 신규 report 1건으로 확인됐다.
- 핵심 원인은 고객 PC가 Windows v1.0.39이고, 운영 required가 v1.0.44인 상태에서 업데이트/실행기 연결이 막히는 쪽으로 분류됐다.
- Windows 재검증 handoff가 생성됐다.

Cafe24:

- `AI로 직원 만드는 법` 같은 비직원 강의/오프라인 상품이 과거 금액 기반 bundle 규칙 때문에 자동 처리된 흔적이 있었다.
- 이후 상품명/명시 코드 중심 allowlist + non-staff denylist가 필요하다는 교훈이 남았다.

Sangsu/Yunmi:

- Sangsu 견적 UI에 고객 이메일 입력이 추가됐다.
- Sangsu preview/PDF/print HTML에 고객 이메일이 포함되게 됐다.
- Yunmi 숏폼 스크립트 prompt에 후킹, 시간대, 공감 전 CTA 등 meta-prompt 규칙이 들어갔다.

참조:

- `handoffs/2026-06-03-jieun-v015-mosaic-github/`
- `docs/deployments/oracle-deploy-20260603-jieun-v015-mosaic.md`
- `docs/windows_handoffs/2026-06-04-windows-v1039-update-exit-recheck/`
- `docs/deployments/oracle-deploy-20260604-151232-sangsu-yunmi.md`

### 2026-06-05: v1.0.49 단일 정본 통합과 예리 웹키 갭 해결

큰 결정:

- 3-branch drift를 끝내고 v1.0.49 단일 정본(main)으로 통합했다.
- 이후 릴리스는 항상 main에서 분기하고, 출시 후 main에 머지한다.
- v1.0.49 양 플랫폼 live 배포가 완료됐다.

해결된 핵심 문제:

- 웹에 provider key가 저장된 사용자는 runner가 실제 key value를 받지 못한다.
- 그런데 web UI/runner readiness가 "AI key ready"로 보이면서 server generation을 건너뛰고 local generation으로 가면, runner는 key 값이 없어 `API key missing`으로 실패했다.
- 해결: 웹키 보유자는 Yeri server generation을 자동 사용하도록 `handleCreateJob`에 `autoYeriServerGeneration`을 적용했다.

추가 해결:

- macOS `aimax://` URL scheme은 Tk hook이 PyInstaller/Tk9에서 안 받아져 PyObjC `NSAppleEventManager`로 교체했다.
- 429 오류는 진짜 결제/잔액 문제와 무료 tier rate limit을 분리했다.
- admin secret-status endpoint를 추가해 provider key 상태를 안전하게 확인할 수 있게 했다.

남은 2차 이슈:

- 서버 생성 글에 이미지 프롬프트가 0개면 runner가 이미지 단계에서 중단할 수 있었다.
- 이 문제는 v1.0.50/51 이미지 failure mitigation으로 이어졌다.

참조:

- Obsidian session: `2026-06-05_AIMAX-AI-Staff-Management_claude_191705.md`

### 2026-06-08 ~ 2026-06-10: v1.0.50/51, 이미지 실패 완화, 실기 E2E

v1.0.50 handoff 핵심:

- 이미지 실패가 글쓰기 전체 실패로 번지지 않게 완화
- 이미지 key 없음/paid image 실패 시 본문 보존
- 이미지 실패 시 공개 발행/예약 대신 임시저장으로 보호 전환
- 오류 진단 코드 추가: `api_key_missing`, `api_key_invalid`, `rate_limited`, `quota_exceeded`, `model_not_found`, `image_paid_required`, `runner_update_required`, `naver_login_required`, `admin_action_required`

v1.0.51:

- 기본 모델을 검증된 `gemini-2.5-flash`로 되돌렸다.
- Windows/macOS v1.0.51 live 배포 완료
- macOS 실기 E2E 전항목 PASS
- E5 neighbor OpenAI key TypeError, E1 `_worker_bulk` fallback 등이 수정됐다.
- hang phase1 분석 결과, 실제 고객 피해는 작고 더 큰 문제는 구버전 runner 비율이었다.

남은 결정:

- MIN 버전을 얼마나 빨리 올릴지
- `naver_login` 실패 5명 원인 조사
- v1.0.52에 page load timeout, worker watchdog, job progress 2차 개선을 실을지

참조:

- `docs/windows_handoffs/2026-06-08-v1050-yeri-hyunju-recovery/README.md`
- Obsidian sessions:
  - `2026-06-10_AIMAX-AI-Staff-Management_claude_083621.md`
  - `2026-06-10_AIMAX-AI-Staff-Management_claude_172736.md`
- `claudedocs/phase1-hang-analysis-user-impact-20260610.md`

### 2026-06-11 ~ 2026-06-12: 송이 Apify Discovery Phase 1

송이 결정:

- 송이는 웹 전용 `web_module` 유지, runner 무관.
- Apify는 BYOK 방식으로 사용자가 자신의 key를 저장한다.
- 버튼 전 비용 예상 표시가 필수다.
- 액터 ID와 단가는 서버 env 설정값이어야 하며 하드코딩하지 않는다.

구현:

- YouTube는 무료 `yt-dlp` 기반
- Instagram/TikTok/Threads/Meta Ads는 Apify actor 기반
- 수집 모드: 인기/최신
- 비용 예상: 시작 고정비 + 결과수 x 단가
- 후보 카드 지표/가져오기 UI
- Apify key 저장 시 `/v2/users/me` 검증
- 제한 hashtag, invalid key, credit issue, delayed run 같은 오류를 사용자에게 분류해 보여준다.

레드팀 후 수정:

- 유료 수집 paid lock 적용, 동시요청 409
- `apify_run_id` 저장 후 재시도 시 기존 실행 재개
- still running이면 failed가 아니라 running 유지
- 글로벌 `APIFY_API_TOKEN` fallback 제거, 사용자 BYOK만 사용
- running job은 10분 timeout 시 `research_discovery_timeout`
- 후보 URL은 http/https만 허용

배포:

- Oracle web 배포 완료
- main commit `e7e31ab`
- 노션 Apify 발급 가이드 업데이트 및 앱 설정 가이드 연결

남은 일:

- Songi Phase 2: 예약 수집, dedup, 구독 목록, 예상 월비용
- Songi Phase 3: 분석, 태그, 브리프 자동화
- still_running 재개 경로를 저속 actor로 실측
- Instagram 실수집 회귀 1회

참조:

- Obsidian sessions:
  - `2026-06-11_AIMAX-AI-Staff-Management_claude_094517.md`
  - `2026-06-12_AIMAX-AI-Staff-Management_claude_014312.md`
- `docs/deployments/oracle-deploy-20260611-163953.md`
- `memory/songi_phase1_plan.md`

### 2026-06-09 ~ 2026-06-15: Cafe24 운영 안정화와 파트너 attribution

6월 9일:

- `AI로 직원 만드는 법` 같은 비직원 강의/오프라인 상품 63건을 감사했다.
- 과거 3건만 `sent`/`bundle`로 남아 있었고, 6월 4일 배포 이후 신규 8건은 `ignored` 처리되는 것을 확인했다.
- 오발송 권한만 최소 범위로 정리했다.
- 다른 직원 결제가 있는 계정은 정상 권한을 유지했다.

6월 15일:

- 기존 n8n Cafe24 주문 메일 흐름은 유지했다.
- AIMAX 서버에 partner attribution helper endpoint를 추가했다.
- Notion partner DB 매칭 성공 시에만 Telegram 주문 알림에 `성함 페이지에서 결제` 한 줄을 추가한다.
- 매칭 실패, Notion 장애, AIMAX endpoint 장애, n8n 변수 누락이 있어도 기존 알림은 그대로 발송되어야 한다.
- 장기적으로 Cafe24 direct webhook/API -> AIMAX 서버 -> Telegram/Notion 단일 파이프라인이 더 좋지만, 현재 운영 중인 n8n은 병행 검증 전까지 유지한다.

남은 일:

- 실제 주문 데이터에 partner/ref/coupon/utm이 들어오는지 확인한다.
- 없으면 파트너 링크/쿠폰/유입값이 주문 데이터에 남는 경로를 따로 만든다.
- n8n token/Telegram/Notion 설정은 장기적으로 credentials/env와 rotation으로 정리한다.

참조:

- Obsidian sessions:
  - `2026-06-09_AIMAX-AI-Staff-Management_codex_160937.md`
  - `2026-06-15_AIMAX-AI-Staff-Management_codex_140409.md`
- `docs/maintenance_reports/aimax_cafe24_partner_attribution_plan_20260615.md`

## 4. 오류 계열별 정리

### A. Naver 로그인/세션/Smart Editor

증상:

- Naver login form이 QR 중심 페이지로 열려 ID/PW input을 못 찾음
- `www.naver.com`은 로그인인데 `blog.naver.com`은 로그아웃처럼 동작
- 글쓰기 진입 시 NID로 재리다이렉트
- Smart Editor iframe이 뜨기 전에 실패 판정
- title/body/image/draft save 단계가 네이버 UI 변경에 취약

해결:

- `NAVER_LOGIN_URL`을 `mode=form`으로 고정
- session cookie 저장/복원 강화, Naver/blog 도메인별 복원
- editor readiness wait 강화
- NID redirect 감지 후 재로그인/세션 sync
- title field click + keyboard/clipboard input 방식으로 Windows v1.0.44 수정
- beforeunload 자동 수락, 도움말 패널/에디터 탐색 보강

남은 위험:

- Naver captcha, 기기 확인, 비밀번호 오류, UI 변경은 여전히 실기기 확인 필요
- `naver_login` 실패 5명 원인 조사가 다음 후보
- Vision fallback/self-healing은 설계만 있고 완성된 핵심 경로는 아니다.

### B. Windows 실행기 업데이트/연결/프로토콜

증상:

- `aimax://agent/connect`와 `open_settings` 실패
- 실행기가 바로 종료되거나 버전이 `-`로 표시
- stale single-instance lock/request file로 연결 불가
- 설치/업데이트가 SmartScreen, file lock, code 5에 막힘
- 구버전 runner가 최신 웹 계약을 이해하지 못해 같은 오류가 반복됨

해결:

- native Go launcher guard
- unified launcher guard 및 split/bundle mismatch 진단
- single-instance lock/state repair
- SmartScreen guidance modal
- platform-specific update_required modal/banner
- claim ACK, runner-start watchdog, delivered-but-not-started sweep
- v1.0.38/39/44/51 순차 안정화

남은 위험:

- 실제 고객은 구버전 runner를 오래 유지한다. 코드가 고쳐져도 배포율이 낮으면 오류가 계속 보인다.
- MIN version 상향 정책을 단계적으로 정해야 한다.
- unsigned installer reputation/SmartScreen은 코드서명 전까지 남는다.

### C. Provider API key 혼선

증상:

- 사용자는 웹에 Gemini/OpenAI/Claude key를 저장했지만 runner는 key value를 못 받아 local generation에서 실패
- local settings 저장이 provider key를 비우거나, 사용자가 local/web 중 어디에 넣어야 할지 헷갈림
- `API key missing`, `content_generation`, quota/rate limit 오류가 한 덩어리로 보임

해결:

- provider key 기준을 웹 `AI/API 연결`로 통일
- local security settings는 Naver ID/password only로 설명
- `autoYeriServerGeneration`: 웹키 보유자 Yeri는 서버 생성으로 자동 전환
- 429를 `rate_limited`와 `quota_exceeded`로 분리
- invalid key, model not found, image paid required 등 진단 코드 추가

남은 위험:

- 웹키 상태는 값이 아니라 configured status만 노출해야 한다.
- provider별 무료 tier/유료 이미지/모델 권한은 계속 바뀔 수 있으므로 UX 문구와 precheck를 유지해야 한다.

### D. 이미지 생성/이미지 삽입

증상:

- 요청 이미지 수와 생성된 image prompt 수가 맞지 않음
- Gemini image quota 429
- 유료 이미지 모델 사용 필요
- 이미지 실패가 글쓰기 전체 실패로 번짐
- 공개 발행/예약이 이미지 실패 상태에서도 진행될 위험

해결:

- image failure diagnostics 추가
- OpenAI image fallback 사용 경로 확인
- v1.0.50/51에서 이미지 실패 시 본문 보존
- 이미지 실패 시 공개 발행/예약 대신 임시저장 보호 전환
- `image_paid_required`, `rate_limited`, `quota_exceeded` 등 코드 분류

남은 위험:

- 실제 이미지 생성은 비용/쿼터 영향이 크다.
- paid live smoke는 한 장, 저비용, 임시저장 only로 제한해야 한다.

### E. Job stuck/running/zombie

증상:

- job이 runner에 delivered됐지만 start/done/failed update가 없음
- app heartbeat는 살아 있는데 worker thread가 selenium에서 오래 막힘
- running 상태가 오래 남아 고객 UI가 멈춘 것처럼 보임

해결:

- claim ACK와 start update evidence 추가
- runner-start timeout watchdog
- delivered-but-not-started sweep
- server-side zombie timeout
- v1.0.51 실기 E2E에서 runner 종료 후 10분 뒤 자동 실패 전환 검증

남은 위험:

- Selenium page load timeout, worker watchdog, job progress 2차 개선은 v1.0.52 후보
- headless sleep loop와 실제 앱 hang을 구분하는 운영 문서가 필요하다.

### F. Songi/Yunmi web-first 오류

Songi:

- old runner unsupported `songi_youtube_discovery` -> server fallback으로 해결
- Gemini `API_KEY_INVALID` -> `research_gemini_invalid_api_key`로 분류
- Apify Phase 1은 paid lock/run_id resume/BYOK/url safety를 적용

Yunmi:

- `reference_url`이 spoken evidence처럼 쓰이는 문제 해결
- URL-only script generation 차단
- shortform prompt meta-rules 반영

남은 위험:

- Songi Phase 2/3 미완료
- Apify still-running 재개 실측 부족
- Yunmi 결과 품질/유료 호출 경로는 계속 검증 필요

### G. Cafe24 주문/온보딩/권한

증상:

- 상품명/금액 판별이 애매해 `needs_review`
- 과거 금액 기반 규칙이 비직원 강의 상품을 bundle로 오판
- 자동 계정 생성/메일 실패 시 복구 경로가 필요
- partner attribution은 주문 데이터에 추적 신호가 없으면 매칭 불가

해결:

- Cafe24 order queue/admin 탭
- 자동 온보딩 실패 stage와 retry/resend
- Telegram needs_review/failure alert
- non-staff product denylist와 기존 오발송 권한 정리
- partner matching helper endpoint + n8n fallback-first patch

남은 위험:

- 새 상품이 생기면 allowlist/denylist를 같이 업데이트해야 한다.
- amount-only rule은 금지한다.
- 장기적으로 direct webhook/API 단일 파이프라인 검토가 필요하다.

### H. Error report/admin/Telegram

추가된 것:

- 오류 보고 접수 카드, 사용자-facing 상태, next guidance
- admin에서 상태/안내문 수정
- `system.agent.diagnostics`, `jobs_recent[]` summary attachment
- provider/model/request/error sanitized diagnostic
- waiting_user 상태에서 사용자가 "해결됐어요/아직 안 돼요"로 재확인

교훈:

- Telegram 알림과 admin 저장 경로가 다를 수 있으므로 report ID, status update, recheck flow를 구분해야 한다.
- admin에 안 보이는 것처럼 보이면 `/api/reports` 신규 접수인지 기존 report recheck인지 먼저 확인한다.

남은 위험:

- 오류가 많아지면 report classification 자동화와 사용자 안내 품질이 지원 부하를 좌우한다.

## 5. 직원별 상태와 개발 포인트

### 예리

분류: hybrid / local-agent-required for Naver input  
핵심 상태:

- 글/이미지 생성은 가능한 한 서버가 맡고, 로컬은 Naver 입력/임시저장을 맡는 방향이다.
- 웹키 사용자는 자동 서버 생성으로 전환된다.
- 이미지 실패 시 본문 보존, 임시저장 보호 전환이 들어갔다.

다음 포인트:

- `naver_login` 실패 유형 조사
- v1.0.52 watchdog/progress 개선
- 실제 구매자 환경에서 최신 runner 설치율 개선
- Vision fallback은 후순위 설계 후보

### 현주

분류: local-agent-required  
핵심 상태:

- Naver/브라우저 자동화가 필요하다.
- v1.0.51에서 E5 neighbor OpenAI key TypeError가 수정됐다.

다음 포인트:

- 현주 작업 생성/수신/완료 smoke를 runner 릴리스마다 같이 확인
- local-only credential 원칙 유지

### 송이

분류: web-first  
핵심 상태:

- URL/link analysis와 YouTube keyword discovery는 server fallback 중심으로 안정화됐다.
- Apify Discovery Phase 1이 live 배포됐다.
- BYOK, paid lock, run_id resume, safe URL 검증이 적용됐다.

다음 포인트:

- 예약 수집, dedup, 구독 목록, 예상 월비용
- 분석/태그/브리프 자동화
- Apify still_running 재개 경로 실측

### 윤미

분류: web-first  
핵심 상태:

- no-paid alpha와 Gemini generation prompt가 있다.
- URL-only/reference URL 오용을 막았다.
- shortform script meta-prompt가 반영됐다.

다음 포인트:

- 유료 생성 경로의 비용 확인/재시도 보호
- 결과 저장/복사/수정 UX
- 권한/상품 정책이 worker catalog와 admin에 정확히 보이는지 확인

### 상수

분류: web-first 또는 catalog worker, 실제 job 범위는 계속 확인 필요  
핵심 상태:

- 견적/quote UI에 고객 이메일 입력과 PDF/print 반영이 추가됐다.

다음 포인트:

- 입력/결과 preview UI 통일
- 실제 직원 상품/권한/가격 정책 확정
- worker catalog smoke와 admin 표시 확인

### 지은

분류: external-download / Windows-only / public  
핵심 상태:

- `AI 오피스 지원` Windows 앱으로 배포됐다.
- v0.1.5: 캡처 이미지 모자이크
- v0.1.6: 멀티 디스플레이 fix, Windows 종료 버튼, native confirmation
- non-Windows에서는 Windows 전용 안내와 다운로드 비활성화가 필요하다.

다음 포인트:

- Windows-only smoke와 download hash 검증 유지
- shutdown button은 실제 종료 동작이라 smoke에서 누르지 않는 것이 정상
- 새 기능 추가 시 별도 GitHub repo `aixlife/aimax-viseo`와 AIMAX catalog 업데이트를 같이 확인

### 나경/현성/은서/기타

상태:

- 나경/Pencil, 은서 prompter, 기타 외부 도구/직원 후보가 repo와 handoff에 섞여 있다.
- 실제 AIMAX employee로 공개할 때는 반드시 `docs/runbooks/aimax-employee-release.md`를 따른다.

다음 포인트:

- 이름, 역할, execution mode, access policy, platform, profile image, job kind/download link를 먼저 확정
- free/public 직원은 계정별 권한 row가 아니라 catalog-level public access를 사용
- 외부 다운로드형은 job composer에 넣지 말고 download/status UX로 분리

## 6. 반복 이슈와 재발 방지 규칙

1. 코드 수정만으로 해결됐다고 판단하지 않는다. 최신 installer로 실제 다운로드/설치/연결해야 한다.
2. Windows가 관련되면 Mac에서만 끝내지 않는다. Shared-Bridge handoff와 Windows completion report가 필요하다.
3. 웹키와 로컬키를 섞지 않는다. provider API key는 웹, Naver credential/session은 로컬.
4. paid retry를 자동으로 하지 않는다. 실패 후에는 request/job id를 확인하고 기존 결과/상태를 먼저 복구한다.
5. open report를 닫을 때는 `done`이 아니라 사용자 조치가 필요한 경우 `waiting_user`를 사용한다.
6. 새 직원은 execution mode를 먼저 정한다: web-first, local-agent-required, hybrid, external-download.
7. free/public 직원은 catalog policy로 공개한다. 기존/신규 계정 모두 자동 제공되어야 한다.
8. Cafe24 상품 판별은 amount-only 금지. allowlist와 non-staff denylist를 함께 관리한다.
9. 운영 서버에 unrelated dirty changes가 있으면 표준 전체 배포 대신 격리 패치가 더 안전할 수 있다.
10. n8n SQLite 직접 패치는 container stop, DB backup, workflow JSON backup, owner 복구, restart, marker verification이 한 세트다.
11. 오류 보고에는 sanitized context를 충분히 넣되, API key/token/password/cookie/signed URL은 절대 넣지 않는다.

## 7. 계속 작업할 때의 체크리스트

### 일반 시작

- `git status --short`
- `memory/MEMORY.md` 최신 결정 확인
- Obsidian project MOC와 최신 세션 1-2개 확인
- 관련 deployment/handoff/evidence 문서 확인
- live `/health`, `/api/version`, `/api/workers` 확인

### Web/server 배포 전

- `node --check oracle/aimax-reports-api/server.js`
- app/admin inline script parse
- `node scripts/smoke_worker_catalog_contract.mjs`
- 수정 기능별 smoke
- `.env` latest/min 버전과 실제 download artifact hash 정합 확인
- remote backup 경로 작성

### Local runner 릴리스 전

- `python -m py_compile` 대상 파일 확인
- `aimax_compliance.py` version 확인
- Mac build smoke와 Windows handoff 분리
- Windows installer SHA/size/completion report 수신
- no-paid smoke 후 필요한 경우에만 명시 승인 paid draft-save gate

### 새 직원 추가/변경 전

- `docs/runbooks/aimax-employee-release.md` 읽기
- execution mode 결정
- worker catalog/server/app/admin 모두 반영
- profile image/download link/platform guidance 확인
- public/free면 catalog-level public access
- 오류 보고 flow에 직원/작업/단계/job id가 들어가는지 확인

### Cafe24/n8n 변경 전

- 기존 n8n fallback을 깨지 않는지 확인
- order data backup
- workflow JSON backup
- secret/token 출력 금지
- non-staff product denylist와 직원 상품 allowlist 검토
- 테스트 Telegram은 운영상 필요한 최소 1건만

## 8. 아직 해결되지 않았거나 후속이 필요한 것

우선순위 높음:

- 구버전 runner 비율을 낮추기 위한 MIN version 상향 정책
- `naver_login` 실패 사용자 원인 조사
- Windows 최신 installer/update flow 실사용 검증 지속
- JSON storage -> SQLite WAL migration
- `server.js`, `app.html`, `app.py` 모듈화

중간 우선순위:

- v1.0.52 후보: page load timeout, worker watchdog, job progress 2차
- provider key/quota UX 고도화
- Songi Phase 2/3
- Cafe24 direct webhook/API 단일 파이프라인 검토
- code signing/installer reputation

낮지만 중요한 것:

- macOS Intel/universal2 지원 여부 결정
- Vision fallback/self-healing editor automation
- worker catalog/admin UI 정합 자동 테스트 확대
- Notion/n8n credential rotation

## 9. 주요 참조 문서 색인

메모리/세션:

- `memory/MEMORY.md`
- `/Users/aixlife/Documents/creator-os-vault/projects/AIMAX-AI-Staff-Management.md`
- `/Users/aixlife/Documents/creator-os-vault/sessions/AIMAX-AI-Staff-Management/`

핵심 maintenance:

- `docs/maintenance_reports/aimax_master_handoff_20260523.md`
- `docs/maintenance_reports/aimax_cross_environment_phase_plan_20260523.md`
- `docs/maintenance_reports/aimax_current_code_independent_audit_20260523.md`
- `docs/maintenance_reports/aimax_architecture_reset_20260523.md`
- `docs/maintenance_reports/aimax_stabilization_phase_log_20260517.md`
- `docs/maintenance_reports/aimax_error_report_triage_20260601_web_ai_local_settings.md`
- `docs/maintenance_reports/aimax_error_report_triage_20260602_v1044.md`
- `docs/maintenance_reports/aimax_cafe24_partner_attribution_plan_20260615.md`

핵심 deployments:

- `docs/deployments/oracle-deploy-20260518-120925-windows-v105-canonical.md`
- `docs/deployments/oracle-deploy-20260528-r3r-v117-v128-rollout.md`
- `docs/deployments/oracle-deploy-20260528-songi-youtube-v131-release.md`
- `docs/deployments/oracle-deploy-20260529-v133-songi-server-fallback.md`
- `docs/deployments/oracle-deploy-20260601-193930.md`
- `docs/deployments/oracle-deploy-20260602-033639.md`
- `docs/deployments/oracle-deploy-20260602-163323-api-key-yunmi-url-fix.md`
- `docs/deployments/oracle-deploy-20260603-jieun-v015-mosaic.md`
- `docs/deployments/oracle-deploy-20260604-151232-sangsu-yunmi.md`
- `docs/deployments/oracle-deploy-20260609-jieun-v016-shutdown.md`
- `docs/deployments/oracle-deploy-20260611-163953.md`

Windows handoff:

- `docs/windows_handoffs/WINDOWS_CONTINUOUS_TIKITAKA_PROTOCOL.md`
- `docs/windows_handoffs/2026-06-08-v1050-yeri-hyunju-recovery/README.md`
- `docs/windows_handoffs/2026-06-04-windows-v1039-update-exit-recheck/`
- `handoffs/2026-05-28-songi-youtube-discovery-v131-release/`
- `handoffs/2026-06-03-jieun-v015-mosaic-github/`

Runbooks:

- `docs/runbooks/aimax-employee-release.md`
- `AGENTS.md`

Evidence:

- `docs/testing/evidence/`
- `docs/testing/cafe24_actual_customer_flow_e2e_20260527.md`
- `docs/testing/aimax_test_accounts.md`

## 10. 다음 AI 개발자에게 짧은 결론

이 프로젝트의 병목은 "기능이 없음"보다 "웹/서버/로컬/Windows/Mac/운영 데이터가 서로 다른 시점의 계약을 보고 있음"이다. 새 코드를 쓰기 전에 현재 계약과 최신 배포 상태를 맞춰야 한다.

예리/현주 문제는 대부분 local runner, Naver, provider key, installer update adoption에서 반복된다. 송이/윤미는 web-first로 밀어야 안정적이고, 지은 같은 외부 앱은 AIMAX worker catalog + download/hash/platform guidance가 핵심이다. Cafe24/n8n은 fallback-first가 생명이다.

새 기능을 붙일 때는 작게 붙이고, 실제 사용자 경로로 검증하고, paid/Naver mutation은 승인받고, Windows는 handoff와 returned evidence 없이는 완료라고 부르지 않는다.
