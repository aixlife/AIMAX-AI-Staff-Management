# P1 후속 라운드 스펙 (2026-07-03)

작성: Fable 5 (메인루프). 구현: Opus 4.8. 대상 파일: `oracle/aimax-reports-api/server.js` (서버 전용 — 러너 배포 불필요가 절대 제약).

배경: PR #4(p1-error-guardrails)가 라이브. 이번 라운드는 (1) waiting_user 오류보고 이메일 알림, (2) 레드팀 M-1/M-2/M-4 수정. 웹 배너·가드 notice·acknowledge 버튼은 이미 라이브이므로 app.html 변경은 원칙적으로 불필요.

---

## 항목 1. waiting_user 오류보고 이메일 알림

### 현황
- 오류보고 상태가 waiting_user 로 바뀌는 경로는 2개: (a) 서버 `handleAdminUpdateReportStatus`, (b) 오라클 서버의 `scripts/aimax_report_auto_guidance.py` — **(b)는 서버 API를 거치지 않고 reports-index.jsonl 을 직접 수정**한다.
- 따라서 전이 지점 훅으로는 (b)를 못 잡는다. **서버 내 주기 스윕**으로 구현한다.
- 기존 메일 경로: `sendAdminGuideEmail` (server.js ~10015) — Apps Script webhook 우선, 없으면 Resend. env: `AIMAX_MAIL_WEBHOOK_URL/SECRET`, `AIMAX_RESEND_API_KEY`, `AIMAX_MAIL_FROM/REPLY_TO`.
- 보고 행에 `account_email` 필드가 있고, `user.email_events` 배열(최대 30)로 발송 이력을 기록하는 관례가 있다.

### 구현
1. `sendAdminGuideEmail` 에서 공용 내부 함수 `sendTransactionalEmail({ to, subject, text, tags, emailType })` 를 추출하고 `sendAdminGuideEmail` 은 이를 감싸는 래퍼로 유지 (기존 호출부 동작 불변).
2. 새 스윕 함수 `sweepWaitingUserReportMail()`:
   - 서버 기동 60초 후 최초 1회, 이후 5분 간격 `setInterval`. 전체를 try/catch 로 감싸 어떤 오류도 프로세스를 죽이지 않는다 (H-1 교훈).
   - 중복 실행 방지 재진입 플래그 (스윕 진행 중이면 skip).
   - 대상 행: reports-index.jsonl 에서
     - `status === "waiting_user"`
     - 오류보고만 (피드백 리포트 제외 — `isFeedbackReport(row)` 가 false)
     - `status_updated_at` 이 최근 7일 이내 (`AIMAX_WAITING_USER_MAIL_LOOKBACK_DAYS`, 기본 7)
     - 아직 `user_notified_at` 없음, `user_notify_failed_at` 없음
   - 수신자: `row.account_email`. `isValidEmail` 실패 시 해당 행에 `user_notify_skipped: "invalid_email"` 기록하고 이후 재시도 안 함.
   - 레이트 제한: 스윕당 최대 10건 발송(`AIMAX_WAITING_USER_MAIL_PER_SWEEP`, 기본 10), 동일 이메일 주소당 6시간 쿨다운(최근 발송 이력은 행들의 `user_notified_at` 으로 판단 — 같은 email 의 다른 행이 6시간 내 발송됐으면 이번 스윕은 건너뛰고 다음 스윕에서 재평가; 실패로 마킹하지 않는다).
   - 킬 스위치: `AIMAX_WAITING_USER_MAIL` env 가 `"0"` 이면 스윕이 아무것도 하지 않는다 (기본 활성). 메일 미설정(`mail_not_configured`) 상태면 조용히 skip + 1회만 warn 로그.
   - 메일 내용 (이모지 금지, 텍스트 기반, 기존 `guideHtmlFromText` 재사용):
     - 제목: `[AIMAX] 오류 보고에 확인이 필요합니다 — <job_kind 라벨 또는 "작업">`
     - 본문: 인사 → 접수 시각(`stored_at` KST 표기) → `public_message` → `user_action_checklist` 를 번호 목록으로 → 앱 접속 링크(`PUBLIC_BASE_URL` + 오류보고 탭 안내) → "조치 후 상단 배너의 '조치했어요, 다시 시도' 버튼 또는 재시도로 이어주세요" → 회신 안내(reply_to).
     - 본문에 시크릿/원문 로그 인용 금지. `redactText` 적용된 필드만 사용.
   - 발송 성공 시: `updateReportIndexSummary(reportId, { user_notified_at, user_notified_channel: "email", user_notified_id: <provider id> })` + 해당 유저를 users.json 에서 email 로 찾아 `email_events` 에 기존 관례대로 이벤트 push (email_type: `error_report_waiting_user`). 유저 못 찾으면 email_events 는 생략 (행 마커만으로 dedup 충분).
   - 발송 실패 시: 행에 `user_notify_attempts` 증가. 3회 도달 시 `user_notify_failed_at` 기록하고 중단 (무한 재시도 금지). 실패는 console.warn.
   - 같은 보고가 나중에 다시 waiting_user 가 되어도 재발송하지 않는다 (`user_notified_at` 이 이미 있으므로). 배너가 계속 커버 — 의도된 정책.
3. `publicReportSummary`/`adminReportSummary` 에 새 필드를 노출할 필요는 없으나, admin 쪽에 `user_notified_at` 정도는 추가해도 좋다 (admin 디버깅용, 선택).

### 검증 (스모크)
새 스모크 `scripts/smoke_waiting_user_mail.mjs` (기존 `scripts/smoke_p1_guardrails.mjs` 패턴 준수 — 임시 DATA_DIR 로 서버 기동):
- 로컬 HTTP 스텁을 띄워 `AIMAX_MAIL_WEBHOOK_URL` 로 지정 → 실제 외부 발송 없음.
- 시나리오: (1) waiting_user 오류보고 1건 → 스윕 → 스텁에 정확히 1건 수신 + 행에 user_notified_at 기록, (2) 스윕 재실행 → 추가 발송 0 (dedup), (3) invalid email 행 → skip 마커, (4) 피드백 리포트 → 발송 안 함, (5) 7일 초과 행 → 발송 안 함, (6) 스텁이 500 반환 → attempts 증가, 3회 후 failed 마커, (7) 킬 스위치 env → 발송 0.
- 스윕 함수는 테스트에서 직접 트리거할 수 있게 내부 엔드포인트나 export 대신 **interval 을 짧게 조정하는 env** (`AIMAX_WAITING_USER_MAIL_INTERVAL_MS`, 기본 300000, 최소 1000) 로 해결.

---

## 항목 2. M-1 — 자유텍스트 시그니처 오분류

### 현황
`classifyJobFailureSignature` (server.js ~2869) 가 구조화 필드(stage, reason, diagnostic_code)와 자유텍스트(visible_error, diagnostic_message, message)를 하나의 문자열로 합쳐 정규식 매칭한다. 사용자 화면 문구에 "timeout", "login", "balance" 같은 일반 단어가 들어가면 오분류된다.

### 구현: 2단계 분류
1. **1단계 (구조화 필드만)**: `stage, reason, error, diagnostic_code` 만 합쳐서 기존 패턴 전체 실행 (머신 코드 패턴 — `server_generation_*`, `runner_*`, `api_key_*`, `quota_exceeded` 등 + 영문 일반 패턴 유지). 결과가 "other" 가 아니면 그대로 반환.
2. **2단계 (자유텍스트 폴백)**: 1단계가 "other" 일 때만 `visible_error, diagnostic_message, message` 를 검사하되, **강한 문구만** 매칭:
   - naver_login_failed: `네이버 로그인|네이버.*(아이디|비밀번호|인증)|captcha|인증 화면` (bare `login` 제거)
   - ai_key_invalid: `api 키 인증|키 인증 실패|invalid.*api.*key|invalid x-api-key` (bare `unauthorized|authentication|permission denied` 는 2단계에서 제거)
   - billing_quota: `결제|크레딧|잔액|요금제|out of credit|insufficient_quota` (bare `balance|billing|payment` 는 2단계에서 제거)
   - runner_not_started: `실행기.*(멈춰|재시작|시작되지 않)`
   - transient: `일시적|잠시 후|rate.?limit|resource_exhausted|overloaded|try again` (bare `timeout|timed.?out|unavailable|temporar` 는 2단계에서 제거 — H-2 계열 오분류의 주범)
   - 매칭 없으면 "other".
3. 두 단계 모두 H-2 순서 보존: runner 계열 검사를 transient 보다 먼저.
4. 기존 호출부 시그니처( `classifyJobFailureSignature(input)` / `jobFailureSignatureClass(job)` ) 변경 금지 — 내부 로직만 교체.

### 검증
`scripts/smoke_p1_guardrails.mjs` 의 signature 유닛 시나리오 확장 (적대 케이스):
- diagnostic_code=`server_generation_auth_failed` + visible_error 에 "timeout" 포함 → `ai_key_invalid`
- 구조화 필드 없음 + visible_error "발행 중 timeout 오류가 났어요" → `other` (bare timeout 은 2단계 매칭 안 됨)
- 구조화 필드 없음 + visible_error "잠시 후 다시 시도해주세요" → `transient`
- stage=`runner_stopped_heartbeating_or_timed_out` → `runner_not_started` (H-2 회귀 확인)
- visible_error "로그인해주세요" 만 → `naver_login_failed` 아님... **아니다**: `네이버` 없는 bare "로그인" 은 2단계에서 제거되므로 `other`. 이 케이스 명시.
- 기존 통과 케이스 전부 회귀 없음.

---

## 항목 3. M-2 — naver readiness 유효성 미반영

### 현황과 제약
- 가드 해제는 readiness `not_ready → ready` 전이에서만 발생 (server.js ~13914). 이미 ready 인 상태에서 같은 자격증명을 재저장하면 전이가 없어 가드가 안 풀린다.
- **러너의 readiness 는 저장 시각을 안 보낸다** (app.py `_collect_web_agent_readiness`: status/has_id/has_password 뿐). readiness "ready" = 자격증명 존재이지 로그인 성공이 아니므로, 전이 없이 ready 만 보고 해제하면 하트비트(수십 초 간격)가 매번 가드를 풀어 가드 자체가 무력화된다. **절대 "ready 면 해제" 로 구현하지 말 것.**

### 구현 (서버 전용으로 가능한 정직한 범위)
1. `sanitizeReadiness` 의 `naver_account` 에 선택 필드 `saved_at: safeIsoOrNull(naver.saved_at)` 추가 (러너가 안 보내면 null — 하위호환).
2. 하트비트 해제 로직 확장: naver_account.status === "ready" 이고 다음 중 하나면 `naver_login_failed` 해제:
   - (기존) 전이 감지 (`previousNaverStatus !== "ready"`)
   - (신규) `saved_at` 이 파싱 가능하고, 해당 유저의 paused 된 naver_login_failed 가드의 `last_error_at` 보다 **이후** — 즉 마지막 실패 이후 자격증명이 재저장됨.
   - 주석에 명시: saved_at 은 P2 러너 릴리스부터 전송 예정, 그 전까지는 전이 감지+acknowledge 경로가 커버.
3. 현행 러너 사용자를 위한 실질 개선: `jobGuardMessage` 의 naver_login_failed 문구에 acknowledge 경로를 명시 — "…네이버 계정을 다시 저장한 뒤, 이 안내의 '조치했어요, 다시 시도' 버튼을 눌러주세요." (재저장만으로 안 풀리는 현행 사각을 UI 안내로 메꾼다.)
4. P2 러너 브리프 연계: `docs/handoffs/windows/2026-07-02-p2-windows-reliability-brief.md` 에 "readiness.naver_account.saved_at (ISO, 로컬 설정 저장 시각) 전송 추가" 요구 한 줄 추가.

### 검증
스모크 확장: (1) ready→ready 재보고 + saved_at 없음 → 가드 유지 (가드 무력화 회귀 방지 — 중요), (2) saved_at 이 last_error_at 이후 → 해제, (3) saved_at 이 last_error_at 이전 → 유지, (4) 전이 해제 기존 케이스 회귀 없음.

---

## 항목 4. M-4 — 가드 기기 단위 분리

### 현황
가드 키가 `(user_id, job_kind)` 라 기기 A 의 실패가 기기 B 의 잡 생성까지 차단한다. 잡은 이미 `target_platform`/`target_device_label` 을 갖고 있고(비면 "아무 기기나"), 하트비트는 `platform`/`device_label` 로 에이전트를 식별한다 (`jobMatchesAgentTarget`, `findHeartbeatAgent` 와 같은 정규화 공간).

### 구현
1. **시그니처 스코프 분류** 헬퍼 추가:
   - 계정 단위 (기기 무관): `ai_key_invalid`, `billing_quota` — 키/결제는 유저 계정 자산.
   - 기기 단위: `naver_login_failed`, `runner_not_started`, `other`, (`transient` 는 가드 제외라 무관).
2. 가드 행에 `device_key` 필드 추가: `deviceKey = normalizePlatform(job.target_platform || "") + "|" + String(job.target_device_label || "").trim()` (빈 타겟이면 `"|"` → 정규화해 `""` 로 취급). 계정 단위 시그니처는 항상 `device_key = ""` 로 기록.
3. `recordJobFailureGuard`: 시그니처 산출 후 스코프에 맞는 device_key 로 행을 find-or-create. 같은 (user, kind, device_key) 행 내에서 시그니처 전환 시 카운트 리셋은 기존 로직 유지.
4. `pausedJobGuard(userId, kind, jobDeviceKey)` 차단 판정:
   - paused 행 중 다음이면 차단: `row.device_key === ""` (계정 단위·레거시 행) **또는** `row.device_key === jobDeviceKey` **또는** 새 잡의 deviceKey 가 `""` (아무 기기나 갈 수 있으므로 어떤 paused 기기든 걸리면 차단 — 안전 우선).
   - 레거시 마이그레이션: 기존 job-guards.json 행에는 device_key 가 없다 → `String(row.device_key || "")` 로 "" 취급 (파일 마이그레이션 불필요).
   - 호출부(handleCreateJob ~14109, handleRetryJob ~14348)에서 새 잡의 target_platform/target_device_label 로 deviceKey 를 만들어 전달.
5. 해제 경로 스코프:
   - `releaseJobGuardsForClasses(userId, classes, deviceKey?)`: deviceKey 인자 추가(선택). 지정 시 `row.device_key === deviceKey || row.device_key === ""` 인 행만 삭제. 미지정 시 기존처럼 유저 전체 (시크릿 재저장 = 계정 단위라 전체가 맞음).
   - 하트비트의 naver 전이/saved_at 해제와 runner 재시작 해제는 **해당 에이전트의 deviceKey** (`normalizePlatform(platform)+"|"+deviceLabel`) 를 전달 — 기기 B 의 재시작이 기기 A 의 가드를 풀지 않게.
   - `clearJobGuardOnSuccess`: 현행 유지 (user+kind 전체 삭제 — 성공은 차단 해제 방향이므로 과하게 풀려도 안전).
   - `handleAcknowledgeJobGuard`: user+kind 의 **모든** 행 unpause+리셋 (사용자 의사 존중, UI 단순 유지). 여러 행이어도 전부 처리하도록 수정 (현재는 단일 find).
6. `publicJobGuard` 에 `device_key` 는 노출하지 않아도 됨 (UI 변경 없음). 단 유저의 가드 목록 API 가 paused 행 여러 개를 반환할 수 있게 되는지 확인하고, app.html 배너가 첫 paused 행만 보여줘도 동작에 문제 없는지 확인 (기존 UI 계약 유지가 우선 — 배열 반환 구조면 그대로 둔다).

### 검증
스모크 확장: (1) 기기 A(naver_login 3연속) paused → 기기 B 타겟 잡 생성 허용, (2) 기기 A paused → 타겟 없는 잡 생성 차단, (3) ai_key_invalid 3연속 → 기기 무관 전부 차단, (4) 기기 B 하트비트 재시작 → 기기 A 의 runner_not_started 가드 유지, 기기 A 재시작 → 해제, (5) 레거시 행(device_key 없음) → 전 기기 차단 + acknowledge 로 해제, (6) 성공 시 전체 해제 회귀.

---

## 공통 요구사항
- 서버 전용. app.py·러너 코드 수정 금지 (P2 브리프 문서 한 줄 추가만 예외).
- 모든 신규 경로는 fail-open: 스토어/메일 오류가 잡 생성·하트비트·프로세스 생존을 해치지 않는다.
- 이모지 금지 (메일 본문 포함). 주석·메시지는 기존 한국어 스타일 준수.
- 시크릿 노출 금지: 메일 본문·로그에 키/비밀번호/원문 시크릿 인용 금지.
- 기존 스모크 `scripts/smoke_p1_guardrails.mjs` 전체 회귀 PASS + 신규 시나리오 PASS. `node --check server.js` 통과.
- 커밋 분리: (1) 이메일 알림, (2) M-1, (3) M-2, (4) M-4 (+스모크는 각 커밋에 포함). 커밋 메시지는 기존 스타일(영문 명령형).
