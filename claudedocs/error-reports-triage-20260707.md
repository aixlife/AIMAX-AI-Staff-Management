# 오류 보고 전수 확인 및 정리 (2026-07-07)

데이터 출처: oracle-server /home/ubuntu/aimax-reports/data/reports-index.jsonl (147건), jobs.json, agents.json, 배포본 server.js 직접 검증

## 0. 치명 발견: 7/4 지은 웹 배포가 P1 서버 가드레일을 롤백시킴

- 7/3 라이브 검증까지 마친 P1 가드레일(PR #5: waiting_user 이메일 알림 스윕, 잡 실패 2단계 분류, 기기별 실패 가드, naver guard saved_at 해제, user id 계정 검증)이 **7/4 23:37 지은 라운드 웹 배포로 전부 사라짐**.
- 원인: 지은 배포 소스 브랜치 `codex/jieun-macos-download`가 P1 브랜치(`feature/p1-followup-guardrails`) 병합 전에 분기됨. server.js를 통째로 교체하는 배포 방식이라 브랜치에 없는 코드는 그대로 롤백됨.
- 검증: 배포본 server.js(624,522B)에 `WAITING_USER_MAIL_ENABLED`, `classifyJobFailureSignature` 모두 0건. 백업 `/home/ubuntu/aimax-backups/20260704-233714/server.js`(679,766B)에는 존재(3건).
- 행동 증거: user_notified_at(이메일 발송 기록)이 7/3 18:20 이후 전무. 7/7 waiting_user 신규 2건 모두 미발송.
- 영향: 7/4 23:37 이후 waiting_user 능동 이메일 알림 침묵 (약 3일). auto-guidance(별도 systemd 스크립트)는 정상 가동 중.
- 복구 경로: 백업 복원은 부적합(지은 카탈로그가 다시 사라짐). 올바른 복구는 PR 병합으로 main 단일화 후 main에서 server.js 재배포.
- 교훈: v1.0.48 "웹 SSOT=fix브랜치" 사건과 동일 패턴 재발. 파일 통째 교체 배포는 배포 직전 브랜치가 라이브 전체를 포함하는지(supserset) 확인 필수.

## 1. 전체 현황 (147건, 7/2 분석 137건 대비 +10)

| 상태 | 건수 |
|---|---|
| done | 55 |
| waiting_user | 63 |
| reviewing | 18 |
| new | 9 |
| working | 2 |

- 미종결 92건. new 9건은 전부 6/2~6/5 구건(그중 1건은 v1.0.49 e2e 테스트 보고) — 사실상 방치, 일괄 정리 대상.

## 2. 7/2 이후 신규 보고 10건 분류

### 오늘(7/7) 2건 — 즉시 주의
1. **AIMAX-RPT-20260707035708** (macOS, blog_team v1.0.2, s***@me.com): 업데이트 설치해도 v1.0.2 그대로. still_failing + "응용프로그램이 응답 없음".
   - 구조적 문제: agents.json 기준 **맥 에이전트 11대 중 7대가 v1.0.1~1.0.2 고착** (v1.0.49/51/56/57 각 1대). 맥 업데이트 경로가 대부분 사용자에게 작동 안 함 — 지은 라운드 교훈(구버전 /Applications 사본 실행)과 동일 패턴 추정.
   - 2차 문제: auto-guidance가 `naver_login_required`로 **오분류** → 엉뚱한 네이버 로그인 안내 발송됨.
2. **AIMAX-RPT-20260707041852** (Windows v1.0.57, d***@aimax.ai.kr): 예리 "아예 실패", content_generation 단계. 안내는 보안 프로그램 chromedriver 차단으로 분류. 같은 사용자가 7/3 bundle integrity mismatch(_asyncio.pyd 1파일)도 보고 — 무결성 자기검사가 실제로 부분 교체를 잡아낸 첫 사례이자, 이 머신의 백신 간섭 정황.

### 수정 완료됐지만 미배포 2건 (사용자에게 "배포 대기" 안내된 상태로 4~5일 경과)
3. **AIMAX-RPT-20260702061037** (예리 숫자 머리말 중복, 평점 5): 서버 수정 69a1b6e — `origin/codex/triage-transient-ai-errors`에 있음. **PR 없음, main 미포함, 서버 미배포** (배포본에 `normalizeYeriDuplicateNumberPrefixes` 0건 확인).
4. **AIMAX-RPT-20260703064210** (worker_running 오분류, 평점 1): app.py 수정 aa2ba1f/8415b64 — **PR #7에 포함(open), main 미포함 → v1.0.57에 미탑재**.

### 나머지 6건
5. AIMAX-RPT-20260702054930 (예리 키워드 콤마 분리·이미지·예약발행 3건 묶음): done — 사용자 자체 종결. 단 "키워드별 글 1개씩" 요구는 제품 개선 후보.
6. AIMAX-RPT-20260702055025 (이미지 첨부 오류): waiting_user, 7/2 이메일 발송됨(회귀 전).
7. AIMAX-RPT-20260703085700 (bundle integrity mismatch v1.0.56): waiting_user, 이메일 발송됨. → PR #7이 이 보고 처리 자동화 포함.
8. AIMAX-RPT-20260703083942 (날짜 최신화 안 됨·이미지 생성 안 됨, 평점 2): reviewing — 원인 미착수.
9. AIMAX-RPT-20260703085222 (글에 AIMAX 브랜드/예리 이름 혼입, 평점 2): reviewing — 프롬프트 누출 계열, 원인 미착수.
10. AIMAX-RPT-20260703180651 (v1.0.51 실행기 연결 안 됨, 팝업은 정상): reviewing, 7/4 still_failing. v1.0.48 계정 불일치 사건과 유사 증상 — 재조사 필요.

## 3. 지은 맥 모니터링 (선택지 3)

- **v0.2.1 배포(7/4) 이후 지은 관련 신규 오류 보고 0건.** 혼합 DPI 실환경 피드백 아직 없음.
- 유일한 지은 보고 = 6/28 **AIMAX-RPT-20260628085501** "지은 채용이 안 보임" (waiting_user, macOS 웹 사용자, 첨부 2장 직접 확인):
  - 대시보드 배너는 "지은은 직원 채용 화면에서 확인 가능"이라는데, 채용 화면은 카운트 "설정 필요 1"이면서 목록은 "조건에 맞는 직원이 없습니다" — **카운트-목록 불일치**.
  - 당시(6/28) 지은은 윈도우 전용 → 맥 사용자 목록에서 필터링된 것으로 추정. 7/4부터 맥 다운로드 라이브이므로 이 사용자는 지금 보일 가능성 높음 → 안내 갱신으로 종결 가능.
  - 잔여 버그 의심: 카운트와 목록 필터 predicate 불일치 (플랫폼 필터가 목록에만 적용) — 웹앱 확인 필요.
  - 이 보고의 public_message도 무관한 "macOS 보안 허용" 안내가 붙어 있음 (오분류).

## 4. PR / 브랜치 현황 (선택지 1)

| PR | 상태 | 내용 |
|---|---|---|
| aimax-viseo #5 | open | Tauri macOS v0.2.1 소스 (라이브 배포 완료분) |
| AIMAX-AI-Staff-Management #1 | open | 지은 맥 롤아웃 웹 변경 (라이브 배포 완료분, 현재 브랜치) |
| AIMAX-AI-Staff-Management #7 | open | 번들 무결성 보고 처리 + worker_running 오분류 수정 + P1 병합 포함 |
| (PR 없음) codex/triage-transient-ai-errors | 브랜치만 | 예리 숫자 머리말 수정 + watchdog 배포대기 무시 |

- main이 라이브보다 뒤쳐지고, 라이브는 서로 다른 브랜치 3개(P1, 지은, 무결성)의 부분합 — 이 분산이 이번 회귀의 근본 원인.
- 참고: 로컬 GITHUB_TOKEN(fine-grained PAT)은 aimax-viseo 접근 불가. keyring 계정(`env -u GITHUB_TOKEN gh ...`)으로는 가능.

## 5. 잡 실패 추이 (7/4 이후)

- 잡 7건: 완료 4 / 실패 3 (image_completion 2건 — 동일 사용자 연속 재시도, content_generation 1건 = 오늘 보고 건).
- 표본은 작지만 6월 63% 실패율 대비 진정세.

## 6. 권고 액션 (CEO 결정 필요)

1. **[긴급] P1 회귀 복구**: PR #1 + PR #7(+ triage 브랜치) → main 병합 → main에서 server.js 재배포. 병합 충돌 검토 필요 (지은 브랜치와 P1 브랜치가 server.js 동시 수정).
2. PR #7 병합 시 worker_running 수정을 다음 러너 릴리스(v1.0.58)에 탑재 결정.
3. 맥 업데이트 고착(7/11대) 대응: 개별 안내 vs blog_team 맥 번들에 재시작 게이트/교체 검증 이식.
4. new 9건(6월 초) 일괄 종결 + 6/28 지은 보고 안내 갱신.
5. auto-guidance 오분류 2건(naver_login 오귀속, 지은 보고에 mac 보안 안내) 분류 규칙 보정.
