# P2 윈도우 신뢰성 작업 결과 보고 (2026-07-03)

브리프: shared-bridge/20_Deploy-To-Windows/2026-07-02-p2-windows-reliability-brief
브랜치: `windows/p2-reliability-20260702` (base: main `cf45410`)
검증 실기: Windows 11 Home 10.0.26200, Defender 실시간 검사 ON, AIMAX 설치·운영 중이던 머신

## 1. 재현 결과 (미션 1)

### 시나리오 A — 앱+런처 실행 중 업데이트 (Defender ON)
v1.0.11 계열 설치본 + AIMAX.exe/런처 실행 중 상태에서 v1.0.56 인스톨러(강화 전, main 기준)를 /VERYSILENT /LOG로 실행.
- 결과: exit 0, 34초, 로그 오류 0건. taskkill이 정상 동작해 RestartManager도 잠금 미감지.
- **핵심 실측: "성공한" 설치 후에도 설치 폴더 3,512개 중 1,758개가 새 페이로드(1,754개)에 없는 구버전 잔재로 잔존.**
  - 잔재: 옛 Python 런타임(python314.dll, *.cp314 pyd), anthropic 794 / google 377 / selenium 289 / pandas 98개 등 패키지 트리 통째, 루트 oracle\ 디렉터리.
  - mtime 분포: 최소 3세대(05-06, 05-28, 06-17) 공존 확인.

### 시나리오 B — 파일 잠금 상태 업데이트
별도 프로세스가 `_internal\python312.dll`을 공유 불가로 연 상태에서 인스톨러 실행(/NOCLOSEAPPLICATIONS).
- 결과: `DeleteFile: file appears to be in use (32)` → 1초 간격 4회 재시도 → 중단/재시도/무시 메시지박스(silent에선 Abort, exit 5).
- 실사용자 흐름: "무시" 클릭 시 해당 파일만 구버전으로 남고 설치 계속 → 부분 교체 직행. 사용자 보고 "deletefile 실패 코드5"와 동일 경로(프로세스 잠금=오류 32, AV/권한=오류 5).

### 시나리오 C — Defender 비교
- Defender 실시간 검사 ON에서 시나리오 A 무오류 성공. 설치 시간대 Defender Operational 이벤트 0건.
- ON/OFF 토글 비교는 관리자 권한 필요 + 위 실측으로 판정 가능해 생략.

## 2. 원인 판정

1. **혼합 상태(cannot import 계열)의 구조적 주범 = 인스톨러의 구세대 잔재 미삭제.** 오류 없는 정상 설치에서도 잔재가 누적된다. PyInstaller onedir은 세대마다 파일 구성이 완전히 달라지는데 기존 [Files] ignoreversion은 덮어쓰기만 하고 삭제하지 않는다. 브리프의 원인 후보 (a)(b)(c) 밖의 제4 원인이며 재현율 100%.
2. **코드5/DeleteFile 실패의 주범 = 파일 잠금 + 사용자의 '무시' 선택.** 잠금 주체는 taskkill을 피한 프로세스(재기동 코어, 자식 프로세스)가 유력. Defender는 이 머신 기준 무혐의.
3. 워커 미시작(38건)의 유력 지점 2곳(코드 정독+계측):
   - `_start_worker`가 `running=True`를 스레드 기동 전에 세팅 → 스레드가 즉시 죽어도 기존 90초 `not running` 검사가 못 잡는 사각지대 (워커 미시작 27건과 일치).
   - 모달 다이얼로그(`wait_window`/`grab_set`)가 UI 스레드를 블로킹하면 `_poll_queue`가 큐의 잡을 영영 안 뽑음 (UI 큐 미처리 7건과 일치).

## 3. 구현 내역 (커밋 해시)

### 미션 2 — 업데이트 안정화 (p2/m2-update-stability)
- `c940c50` Harden Windows installer against partial updates
  - **[InstallDelete] 구세대 잔재 정리**: `{app}\_internal` 통삭제 + 루트 *.dll/*.pyd/*.pyc/*.py/base_library.zip 정리 (원인 1 직접 차단)
  - AppMutex(app.py에 CreateMutexW 추가) + CloseApplications=force + RestartApplications=no + restartreplace + SetupLogging(로그를 %APPDATA%\NaverBlogAuto\logs\aimax-setup.log로 수거)
  - taskkill 후 고정 Sleep(1500) → 폴링 대기(최대 10초, 잔존 시 재kill)
- `2b8f1b3` Add build manifest and startup integrity self-check
  - build.py가 onedir 전 파일 {경로, sha256, size} 매니페스트 생성 → app.py 시작 시(Tk 전) 대조. 불일치 시 한국어 재설치 안내 + error_reporter 자동 보고 + 종료(exit 3). 매니페스트 없으면 통과(구버전/맥 호환). `_internal` 하위 매니페스트 외 코드 파일(잔재)도 unexpected_file로 감지.
- `2580df7` Probe critical imports at startup to catch mixed installs
  - content.ai_text / posting.editor / local_agent.runtime try-import, ImportError 시 재설치 안내 경로
- `247cb67` Kill app before AppMutex check and purge stale oracle dir
  - InitializeSetup에서 선제 종료(정상 경로에선 AppMutex 프롬프트 없음, taskkill 실패 시에만 최후 방어선) + `{app}\oracle` 잔재 정리

### 미션 3 — 워커 미시작 2차 좀비보호 (p2/m3-worker-watchdog)
- `ec2f7fa` 계측 로그 + 하트비트 progress_stage 확장: claimed→queued_to_ui→ui_received→worker_start_requested→worker_thread_started→worker_running 단계 계측, 하트비트에 `progress_stage`(수신됨/워커기동/로그인/작성중/발행중)
- `77cdde4` 워커 기동 감시 + 실행기 자체 재시작: 수신 후 30초 내 워커 미기동 시 서버에 실패 보고(동기) 후 자체 재시작. **런처는 감독자가 아님을 확인**(코어 기동 8초 후 스스로 종료, 재기동 로직 없음) → 단일 인스턴스 락 해제 후 새 코어를 직접 detached 스폰. `AIMAX_AGENT_DISABLE_WORKER_RESTART`로 보고-전용 전환 가능. 판정 로직은 `local_agent/worker_watchdog.py` 순수 함수로 분리(단위검증 14케이스 PASS).
- `0c324c2` readiness.naver_account.saved_at (ISO 8601) 전송 + 자격증명 저장 시점 기록
- `8345598` 모달 설정창 열림 중 재시작 억제(오탐/입력유실 방지)

통합: `71a1857` (머지, build.py 가드 목록 충돌 수동 해소)

## 4. 검증 결과

| 항목 | 결과 |
|---|---|
| py_compile (app/build/bundle_manifest/worker_watchdog/client) | PASS |
| 빌드 가드(신규 마커 6종 포함) + 클린 빌드 + 매니페스트 생성(1,754 파일) | PASS |
| ISCC 컴파일(경고 0) | PASS |
| 매니페스트 로직 단위검증(생성/변조/삭제/잔재/깨진 매니페스트 등 10케이스) | PASS |
| 워치독 판정 단위검증 14케이스 | PASS |
| headless_agent_polling_smoke: 단계 계측 순서 정상, 잡 완주 | PASS (기존 ai_model 결함으로 마지막 단계 실패 — 베이스에서도 동일, 아래 위험 4 참조) |
| **A2 실기**: 잔재 1,758개 오염 설치본 + 앱 실행 중 → 강화 인스톨러 | **PASS — 잔재 0개**(설치본=페이로드 완전 일치), oracle 제거, 설치 로그 자동 수거 |
| **A3 실기**: 뮤텍스 생성하는 강화 앱 실행 중 → 강화 인스톨러 재실행 | PASS — 프롬프트 없이 자동 종료 후 설치(exit 0) |
| **C2a 실기**: 강화 설치본 앱 기동 | PASS — 무결성 검사 통과, 정상 창("AIMAX 웹앱 연결") |
| **C2b 실기**: _internal pyd 변조 후 기동 | PASS — "AIMAX 설치 오류" 재설치 안내 창에서 차단, 본 실행 진입 안 함 |
| **B2 실기**: 파일 잠금 + 강화 인스톨러 | 잠금 자체는 여전히 A/R/I 발생(아래 위험 1). 단 Abort 후엔 앱이 기동 불가 상태(로더 오류)로, Ignore 후엔 무결성 검사로 차단 — **"부분 교체가 발생해도 혼합 상태로 실행되지 않음" 완료 기준 충족** |

## 5. 남은 위험

1. **restartreplace는 PrivilegesRequired=lowest에서 재부팅 예약을 등록하지 못해**, 잠금 파일은 여전히 중단/재시도/무시 상호작용이 발생한다. 완화: 잠금의 주 원인(실행 중 프로세스)은 InitializeSetup 선제 종료+폴링으로 제거되고, 잔여 케이스는 무결성 자기검사가 혼합 실행을 차단.
2. **시작 시 전 파일 해시 ≈ 2.8초**(실측, 1,754파일): 느린 디스크에선 더 길 수 있음. 필요 시 "설치 직후 1회만 전체 해시" 최적화 여지.
3. **맥 매니페스트 미생성**: .app은 codesign 후 파일 추가가 서명을 깨서 onedir에만 생성(맥은 검사 통과=현행 유지). 맥 빌드에서 서명 전 생성 방식 검토 필요 — 맥 쪽 후속.
4. **기존 결함 발견(이번 범위 밖)**: headless 스모크가 `worker_write did not receive web ai_model`로 실패 — 베이스(main)에서도 동일 재현. `_normalize_ai_model` 관련. 별도 티켓 권장.
5. **워커 재시작 락 해제 실패 가능성**: unlink 실패 시 새 인스턴스가 기동 거부될 수 있음(unlink→0.3s→스폰으로 완화).
6. **미션 4 부분 완료**: 신규 설치→기동→업데이트 재설치→재기동은 실기 PASS(위 A2/A3/C2a). 실제 네이버 로그인→서버 생성 글쓰기→로컬 발행 구간은 실계정/유료 AI 호출/실발행이 필요해 사용자 승인 대기(브리프 제약 및 07-01 v1055 핸드오프 금지사항과 상충 방지).

## 6. 증거 파일 (요청 시 제공)

install_scenA.log / install_scenB_locked.log / install_A2_hardened.log / install_A3_mutex.log / install_B2_locked.log / preinstall_inventory.csv / build_p2_baseline.log / build_p2_hardened.log — 세션 스크래치패드 보관, 필요 시 shared-bridge로 이동 가능.
