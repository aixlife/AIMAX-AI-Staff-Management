# 윈도우 작업 브리프 — 보안 프로그램의 브라우저 드라이버 차단 대응 (2026-07-07)

이 문서는 윈도우 머신의 Claude Code가 그대로 읽고 실행하는 작업 지시서다. 모든 보고와 사용자 노출 문구는 한국어로 작성하고, 이모지는 절대 사용하지 않는다.

## 1. 먼저 알아야 할 상태 변화 (2026-07-07 main 단일화)

- main이 다시 단일 SSOT다. 오늘 3개 브랜치가 main에 병합되고 서버가 main 기준으로 재배포됐다:
  - PR #7 (`codex/bundle-integrity-guidance-20260703`): 번들 무결성 보고 서버 처리 + worker_running 오분류 수정(구 인라인 경로)
  - `codex/triage-transient-ai-errors`: 예리 숫자 머리말 중복 서버 수정 + watchdog 배포대기 무시
  - PR #1 (`codex/jieun-macos-download`): 지은 맥 v0.2.1 카탈로그
- **P2 신뢰성 작업은 전부 v1.0.57에 탑재 완료 상태다** (PR #6 → PR #13 범프): 인스톨러 잔재 정리·AppMutex, 빌드 매니페스트+시작 무결성 자기검사, 워커 기동 감시(2차 좀비보호), AV 격리 힌트 다이얼로그.
- **worker_running 오분류 문제는 새 작업이 아니다.** v1.0.57의 `local_agent/worker_watchdog.py`가 `WORKER_ALIVE_STAGES`(worker_running, login, writing 등)에서 감시를 건너뛰므로 이미 해결돼 있다. 구버전(v1.0.55 이하) 사용자는 업데이트 안내로 처리한다. 러너 재빌드 불필요.

## 2. 이번 미션의 근거 (실사용자 오류 보고)

- **[2026-07-08 정정]** `AIMAX-RPT-20260707041852-b5a5f060`은 당초 근거로 썼으나 재조사 결과 **드라이버 차단이 아니라** 서버 생성 실패(`yeri_claude_invalid_json` — 잡 result로 확인)였다. 자동 안내의 텍스트 키워드 매칭이 오분류한 것. 이 건은 이 브리프의 근거에서 제외한다.
- 유효 근거: `AIMAX-RPT-20260703085700-24b89043` (2026-07-03, v1.0.56) bundle integrity mismatch(`_internal/_asyncio.pyd` 1개 파일) — 무결성 자기검사가 실제 부분 손상을 잡아낸 첫 실사례, 백신 격리 정황. 그리고 서버 auto-guidance에 `browser_driver_policy_blocked` 카테고리가 존재한다는 것 자체가 과거 드라이버 차단 사례가 반복돼 왔다는 뜻이다(winerror 4551, 애플리케이션 제어 정책 매칭 패턴 참조).
- 패턴: 백신 간섭 머신에서는 (a) 설치 파일 일부 격리 → 무결성 실패, (b) 드라이버 실행 차단 → 잡 실패가 함께 나타난다. 현재는 (a)만 다이얼로그 힌트가 있고 (b)는 잡이 실패한 뒤에야 모호한 오류로 표면화된다. preflight 자기검사의 가치는 유효하나, 우선순위는 서버측 오분류 수정(맥 담당)보다 뒤로 조정될 수 있다 — 착수 전 맥 쪽 라운드 상태를 확인할 것.

## 3. 미션 — 드라이버 실행성 preflight 자기검사 (v1.0.58 후보)

### 구현
1. 잡 실행 직전(워커가 Selenium/undetected_chromedriver를 띄우기 전) 드라이버 실행성 자기검사를 추가한다:
   - chromedriver 바이너리 존재 + 실행 가능 여부(`--version` 서브프로세스, 짧은 타임아웃) 확인.
   - 실패 시 잡을 시작하지 않고 명확한 오류 코드(`driver_blocked_by_security` 제안)로 즉시 실패 보고 — 지금처럼 content_generation 단계까지 가서 모호하게 죽지 않게 한다.
   - undetected_chromedriver가 런타임에 드라이버를 받아 패치하는 경로라면, 그 다운로드/패치 산출물 경로에 대해 같은 검사를 적용한다.
2. 실패 보고 result에 진단 정보를 포함한다: 드라이버 경로, 서브프로세스 종료코드/예외 문자열, Defender 보호 기록 존재 여부(가능하면 PowerShell `Get-MpThreatDetection` 결과 요약, 실패해도 무시).
3. 사용자 노출 문구(러너 로그·서버 안내 공용): "Windows 보안 또는 백신 프로그램이 브라우저 드라이버 실행을 차단했습니다. 보안 프로그램의 보호 기록에서 chromedriver/AIMAX 차단 내역을 허용(복원)한 뒤 다시 시도해주세요."
4. 서버측 안내 연동은 맥 쪽에서 이어받는다. 러너는 오류 코드와 진단 result만 정확히 보내면 된다.

### 제약
- app.py 구조 변경 시 build.py의 심볼 grep 빌드 가드를 함께 갱신한다 (P2 브리프와 동일 규칙).
- 순수 함수는 `local_agent/` 모듈로 분리해 단위 검증 가능하게 한다 (worker_watchdog.py 패턴).
- 시크릿·계정 정보는 진단 result에 절대 포함하지 않는다.

### 검증 기준
1. 정상 머신: preflight 통과 후 기존 잡 흐름 무변화 (기존 e2e 스모크 PASS).
2. 차단 재현: chromedriver를 ACL로 실행 거부(또는 이름 변경)한 상태에서 잡 실행 → 잡이 `driver_blocked_by_security`로 즉시 실패하고 보고에 진단 정보 포함.
3. `python -m pyflakes`/기존 빌드 가드 통과 + Windows 빌드 + 무결성 매니페스트 생성 확인.

## 4. 함께 확인 (같은 세션에서, 별도 커밋)

1. **반복 실패 머신 원격 진단 자료**: 위 사용자 머신처럼 백신 간섭이 의심될 때 사용자에게 보낼 복붙 가능한 확인 가이드 초안 작성 — Windows 보안 보호 기록 확인 → chromedriver/AIMAX 허용·복원 → 폴더 제외 등록(설치 경로) → 재시도. `docs/handoffs/windows/`에 md로 저장.
2. **v1.0.57 업데이트 유도**: v1.0.55 이하 잔존 사용자(worker_running 오분류 등 기수정 버그에 계속 노출)는 서버 안내로 처리 중이다. 러너측 추가 작업 없음 — 참고만.

## 5. 보고 형식

- 결과 보고: `docs/handoffs/windows/2026-07-07-windows-results-av-driver-block.md` (P2 결과 보고 형식과 동일: 재현 결과 → 원인 판정 → 구현 커밋 → 검증 → 남은 위험)
- 브랜치: `windows/av-driver-preflight-20260707` (base: 오늘자 main `e60ad8f` 이후)
- 배포 판단은 맥 쪽 CEO 게이트에서 한다. 빌드 산출물과 SHA256만 준비해두면 된다.
