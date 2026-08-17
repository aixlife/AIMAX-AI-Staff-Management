# 예리 디벨롭 — blogpostauto(공생 납품본) 이식 가치 분석

작성 2026-08-18 · 읽기 전용 정적 분석(코드·문서·git 로그만, 실행·로그인·발행 없음)
분석 대상 `/Users/aixlife/Projects/blogpostauto` (HEAD 868e047, v0.5.0-20260811) · 비교 기준 `/Users/aixlife/orca/workspaces/AIMAX-AI-Staff-Management/오류해결` (HEAD 8a400bd)

---

## 결정 박스

| 항목 | 내용 |
|---|---|
| 질문 | 외주 소스(blogpostauto)의 기법을 예리(AIMAX 블로그 AI 직원)에 이식할 가치가 있는가. 있다면 무엇을, 어떤 순서로. |
| 추천 | **부분 이식 승인 — 브라우저 스택·GUI·계정/프록시 운영 모델은 가져오지 않고, "실패를 정형화하고 스스로 판정하는 계층" 5종만 우리 구조에 재구현한다.** 순서: (1) 로그인 상태 분류기 → (2) 발행 후 검증 → (3) 정형 결과·단계 이벤트·진단 번들 → (4) 셀렉터 헬스체크 + 셀렉터 팩 원격 갱신 → (5) 잡 상한 타임아웃 + 캡차/추가인증 쿨다운 재큐. 총 9~13 라운드(라운드 = 한 번 구현하고 결과를 보는 사이클). |
| 근거 1 | 예리의 8월 실패는 "선택자 깨짐"보다 **"깨진 뒤 무엇이 깨졌는지 시스템이 모른다"**가 본질이다. blogpostauto는 같은 문제를 7월에 겪고 `LoginStatus` 7종 분류·발행 후 `VERIFIED/UNVERIFIED/FAILED` 판정·단계 이벤트 JSONL·allowlist 진단 번들·무자격 셀렉터 헬스체크를 넣어 7/31 실사용 신버전 46건 전량 성공(구버전 구간 32건 중 5건 이슈)을 기록했다(`claudedocs/backlog-code-crosscheck-20260730.md` 4-3). 예리는 이 5개가 전부 없거나 절반만 있다. |
| 근거 2 | 5종 모두 OS 의존이 없다(URL·page_source·DOM 카운트·JSON·HTTP GET). 맥·윈도우 양쪽에서 그대로 성립하고, 우리 서버(server.js)의 정형 코드 1순위 분류(`REPORT_STRUCTURED_JOB_GUIDANCE_RULES`)와 바로 맞물린다. |
| 근거 3 | 반대로 blogpostauto의 핵심 입력 경로(Windows CF_HTML 클립보드 붙여넣기·`ctypes` 파일 대화상자·PowerShell 프로세스 정리)는 `sys.platform != "win32"`면 즉시 `False`로 빠져 맥에서 본문 서식·동영상 업로드가 무너진다. 브라우저 스택도 SeleniumBase UC로 우리(uc + selenium-stealth)와 다르다. 이 계층을 옮기면 맥이 깨지고 회귀 검증 비용만 커진다. |
| 반대 근거 | (a) 이 코드는 메이크패밀리가 **공생에 납품한 용역 산출물**이다(견적서 v2 "작성 메이크패밀리 개발팀"). 저장소 안에 소유권·라이선스 조항이 없어 계약서를 확인하기 전까지 "통째 복사"는 피해야 한다 — 이 보고서는 전부 "기법 재구현"으로 쓴다. (b) 예리는 사용자 본인 계정 1개 + AI 생성 원고 모델이라 다계정·프록시·원고 폴더 규칙은 제품 방향과 어긋난다. (c) 예리의 진짜 큰 빚은 `app.py` 8,057줄 안의 `_worker_write` ~600줄과 `server.js` 19,055줄 단일 파일이다. 이식만으로는 이 부채가 줄지 않으며, Phase 6(구조 분리)은 별도 승인이 필요하다. |
| 승인 시 | Phase 1~2(관측성 + 로그인 분류기, 3~4 라운드)부터 착수. 첫 라운드 산출물은 `LoginStatus`/`PostStatus` enum + `classify_login_state()` 순수 함수 + HTML 픽스처 단위 테스트, 실계정 로그인 실기 1회. 그 결과를 보고 Phase 3 이후 게이트. |
| 거절 시 | 8a400bd(로그인 버튼 후보 + `naver_login_page_changed` 안내) 배포·실기 검증만 마무리하고, 다음 네이버 화면 변경 때 같은 라운드를 반복한다. 예상 비용: 화면 변경 1회당 실패 방치 3~5일 + 수동 라운드 1~2회(7/21 model_not_found, 8/18 로그인 개편 사례 기준). |

---

## 0. 한 장 요약 — 그래서 우리가 뭘 하면 되는가

| 순위 | 이식 후보 | 무엇을 | 예리 어디에 | 맥/윈 | 규모 | 위험 |
|---|---|---|---|---|---|---|
| 1 | 로그인 상태 분류기 | URL 우선 → 문구 마커 순으로 `SUCCESS/CAPTCHA/INVALID_CREDENTIALS/ADDITIONAL_VERIFICATION/ACCOUNT_PROTECTED/FAILED/UNKNOWN` 판정 + `deviceConfirm` "등록안함" 자동 통과 | `auth/naver_login.py`(신규 `classify_login_state`), `constants.py`, server.js 분류 규칙 | 양쪽 OK | 1~2R | 낮음. 오분류 시 안내만 틀림 |
| 2 | 발행 후 검증 | 발행 클릭 ≠ 게시. `logNo=` URL 도착=VERIFIED, 작성폼 잔류+에러 토스트=FAILED, 그 외=UNVERIFIED. **UNVERIFIED는 자동 재발행 금지** | `posting/publisher.py`(`publish_now` 뒤), `_worker_write` result, server `imageCompletionIssue` 옆 | 양쪽 OK | 1~2R | 낮음. 오탐 시 "확인불가"로만 표시 |
| 3 | 정형 결과 + 단계 이벤트 + 진단 번들 | `PostStatus` enum·`detail_code`를 러너 result 표준 필드로, `LOGIN→EDITOR_READY→CONTENT_FILLED→SUBMIT_SENT→VERIFY` JSONL, 실패 시 allowlist zip(manifest/result/events/screenshot) 로컬 생성 + 오류보고 시 첨부 | `app.py _worker_write`(result 스키마), `diagnostics/error_reporter.py`, server `handleReport`·분류 규칙 | 양쪽 OK | 2~3R | 중간. 서버 정규식이 예외 문자열에 의존하는 현 구조와 병행 기간 필요 |
| 4 | 셀렉터 헬스체크 + 셀렉터 팩 | (a) 서버 cron이 자격증명 없이 NID 로그인 폼 GET → 마커 존재 검사 → 텔레그램/티켓 경보 (b) 로그인·에디터·발행 셀렉터를 버전 있는 JSON으로 분리, 서버가 내려주고 러너가 병합(스키마 검증+롤백) | server.js(또는 oracle systemd 타이머), `constants.py`→`selectors/pack.json`, `web_agent/client.py` | 양쪽 OK | 1R + 2~3R | (a) 낮음 (b) 중간 — 잘못된 팩 배포가 전 사용자에 즉시 영향. 스키마·테스트·롤백 필수 |
| 5 | 잡 상한 타임아웃 + 쿨다운 재큐 | 워커 스레드 join(timeout) → 초과 시 드라이버 강제 종료 + `timed_out` 정형 보고(서버 45분 stall 전 로컬 6~10분에서 끊음). 캡차/추가인증은 30분 쿨다운 뒤 1~2회 자동 재큐(opt-in) | `app.py _worker_write` 호출부, server `handleRetryJob`·연속실패 가드 | 양쪽 OK | 1R + 1~2R | 재큐는 계정 보호조치 트리거 가능 → 기본 OFF, 횟수 상한 |

이식하지 않을 것: SeleniumBase 스택 교체, Windows CF_HTML 클립보드/파일 대화상자/PowerShell, 계정-프록시 1:1·IP 로테이션(adb 테더링), 원고 폴더/신호 태그 체계, customtkinter GUI, incognito 기본값, `page_source` 문자열 매칭만으로 하는 상태 판정(우리 쪽 약점이기도 함).

---

## 1. 외주 소스의 정체 (전제 확인)

- **누가 만들었나**: 견적서 v2(2026-04-16) 발행 주체가 "메이크패밀리 개발팀", 총 180만 원, 납품 형태 "Windows 실행 파일 + 사용 설명서". `AGENTS.md`/`CLAUDE.md`는 "의뢰인(공생 김선도 대표) 납품용", 구현은 "Fable 스펙 → Codex 생성". 즉 **우리가 공생에 납품한 용역 산출물**이지 남이 만든 걸 우리가 받은 것이 아니다.
- **소유권/라이선스**: 저장소 안에 소유권·IP 조항 문서가 없다(`grep 저작권|소유권|지식재산` 무결과, 견적서에도 없음). 용역 계약서 조항이 정본이다. 조항 확인 전까지는 이 보고서대로 "기법 재구현"만 하고, 파일 복사·함수 이름 그대로 이식은 피한다. 반대로 CLAUDE.md에 "AIMAX 스킬을 이 프로젝트에 반입 금지"가 있듯, 방향이 반대인 흐름(AIMAX → 공생)도 이미 분리돼 있다.
- **레거시 exe(`블로그포스팅_공생.exe`)**: VB.NET WinForms(문서 `docs/legacy-program-analysis.md`), Selenium .NET dll 동봉. 전 개발자 산출물이며 소스 없음. Python `src/`는 이 exe를 역분석해 흐름을 계승한 재개발본.
- **`adb.exe`가 하는 일 (확인)**: exe UTF-16 문자열에서 `/c adb devices`, `/c adb shell svc data disable`, `/c adb shell svc data enable`, `settings put global airplane_mode_on … --ez state`, `https://api64.ipify.org`, `테더링변경`, `--proxy-server=`가 확인된다. 즉 **USB 연결 안드로이드 폰의 모바일 데이터를 껐다 켜서 테더링 IP를 바꾸는 IP 로테이션** 장치다("모바일 경유 우회"가 아니라 "IP 세탁"). Python 재개발본에는 `RunSettings.rotate_network` 플래그와 문서 언급만 남고 **실제 adb 호출 코드는 없다**(`grep adb src/` 무결과). 이식 대상이 아니며 아래 3절에서 금지 항목으로 분류한다.
- **규모**: `src/` 12,901줄(editor.py 5,019 / gui.py 1,871 / post_flow.py 893 / login.py 860 / batch_runner.py 427 / batch_plan.py 452), 테스트 232개(19 파일), 커밋 74개(4월~8/11), 진단 스크립트 19개, 스펙 문서 6개.

---

## 2. 아키텍처 비교 (외주 vs 예리)

| 축 | blogpostauto (공생) | 예리 (AIMAX) | 판정 |
|---|---|---|---|
| 형태 | 단일 Windows 데스크톱(customtkinter GUI + CLI). 서버 없음 | 하이브리드: 웹앱/서버(server.js) 잡 큐 + 사용자 PC 로컬 실행기(Tk `app.py`) + 헤드리스 `--agent` | 다름. 예리는 서버가 있어 헬스체크·셀렉터 팩·자동 재큐를 **서버에** 둘 수 있다(외주본보다 유리) |
| 브라우저 | SeleniumBase `Driver(uc=True)`, incognito 기본, 계정별 `user_data_dir` 프로필, 프록시 옵션 | undetected-chromedriver → Selenium 폴백 + selenium-stealth, 영구 `default` 프로필, 랜덤 창 크기, 맥/윈 브라우저 탐색·프로세스 정리 분기 | 예리 유지. 스택 교체는 회귀 비용 대비 이득 불명 |
| 로그인 입력 | `send_keys` 실키(1순위) → JS value 주입(폴백). `#id/#pw` 하드코딩, 로그인 버튼 6후보 + `button[id^='loginBtn']` 중 보이는 것 | JS value 주입(1순위) → 클립보드 붙여넣기 → 수동 대기 180초. 버튼 5후보 + 폼 내 "로그인" 라벨 스캔, passkey 제외 | 유사(8/18 수정 후). 예리 쪽 라벨 스캔 폴백이 오히려 한 겹 더 있음 |
| 로그인 상태 판정 | `classify_login_state()` — URL(captcha/challenge, idSafetyRelease, deviceConfirm, nid 이탈=성공) → 퀴즈 마커 → 불일치 마커 → 보호조치 → 추가인증 → 캡차 → FAILED/UNKNOWN. **7종 enum + needs_manual_action** | `nidlogin.login` 잔류 여부 + `"자동입력"`/`captcha` 문자열. 2단계·새기기·보호조치·비번오류를 구분하지 않고 "수동 대기"로 흡수 | **외주본이 명확히 우위** → 이식 1순위 |
| 새 기기 등록(deviceConfirm) | 자동으로 "등록안함" 클릭 후 목적지 진행(7/22 실측) | 미처리(NID 잔류로 취급) | 이식 |
| 세션 재사용 | 프로필 세션 → 쿠키 파일 복원 → 신규 로그인, 성공 후 `sync_blog_session` + 쿠키 병합 저장(30일) | 계정별 쿠키 파일 30일 + `_blog_session_ready` → CDP `Network.setCookie` 복원 → 신규. 동등 | 동등. 예리 CDP 복원이 더 낫다 |
| 프로필 잠금 Chrome | PowerShell CIM으로 같은 user-data-dir 쥔 chrome.exe만 종료(Windows 전용) | 맥 pgrep / 윈 PowerShell 양쪽 구현 + SingletonLock 정리 + 손상 시 프로필 백업 재생성 | 예리 우위 |
| 에디터 진입 | `write_entry.py` URL 후보 4개 + mainFrame 전환 + page_source 마커로 READY 판정 | `GoBlogWrite.naver` 2회 → NID면 재로그인 → 직접 URL 후보 4개 → `ensure_editor_context` iframe 6종 | 동등 |
| 제목 | ActionChains 클릭 + Ctrl+A/Del + send_keys (Ctrl 하드코딩) | 클립보드 3회 → human_type 2회 → execCommand 2회, 매번 `_read_title_text`로 검증, Cmd/Ctrl 분기 | 예리 우위 |
| 본문 | **Windows CF_HTML 클립보드 + Ctrl+V**(인라인 서식 보존), 맥은 plain 타이핑 폴백 | human_type 글자별 가변 지연 plain 텍스트, 인용구/링크만 별도 | 목적이 다름(외주=서식 원고 재현, 예리=AI 원고). 이식 불필요 |
| 이미지 | 이미지 버튼 → DOM `input[type=file]` send_keys(7/28 "건당 80초 단축") → Windows 대화상자 폴백. 45초 검증, 3회 | 클립보드 이미지 붙여넣기(맥 osascript/윈 CF_DIB) 1순위 → 버튼+file input 폴백, DOM img 카운트 14초 검증 | 상충 관찰: 외주는 "file input 있음", 예리 주석은 "input 0개 라이브 확인". 예리 폴백에 이미 file input 경로가 있으니 **순서만 실측 후 재검토**(Phase 3 항목) |
| 카테고리 | 발행 레이어 **루트 안에서만** 토글 → 항목 텍스트 정확 매칭 → 행 안 radio/label 클릭 → 토글 텍스트로 재검증, 결과 코드 4종 | `[class*='category'] button` 전역 매칭, 실패 경고만 | 외주 우위(스코프 제한·검증). 이식 |
| 임시저장 검증 | 토스트/page_source "저장되었습니다|임시저장" 정규식 | 토스트 6종 / aria-label 카운트 / autosave 문구 변화, 미확인 시 실패 처리 | 예리 우위 |
| 발행 후 검증 | `PostingFlow._verify_publish` 25초 폴링: `logNo=` URL=VERIFIED, 작성폼+에러 텍스트=FAILED, 그 외 UNVERIFIED(자동 재발행 금지) | **없음**. "즉시 발행 완료" 로그만 | **외주본 우위** → 이식 2순위 |
| 예약 발행 | 라디오 → 열린 달력 컨테이너 안에서만 날짜 클릭(7/22 헤더 '1' 오클릭 사고 후) → 시/분 5단 폴백 → 10분 슬롯 올림 재시도 | 라디오 → datepicker 24개월 상한, 다른 달 칸 오클릭 방지 → Select value→text 폴백, 분 랜덤 | 동등. 외주의 "10분 슬롯 올림 재시도"만 참고 |
| 다계정/프록시 | 계정 N × 프록시 1:1, 계정별 프로필, 배치 순차 실행 | 사용자 본인 계정 1개(원격 잡), Bulk 패널만 다계정 | 제품 방향 다름. 이식 안 함 |
| 스케줄 | 프로그램이 기다리지 않고 네이버 예약 UI에 등록, 시작시각+간격 계산 | 동일 방식 + 서버가 키워드 분리 잡에 stagger | 동등 |
| 결과 모델 | `PostStatus` 12종 enum + `PostResult{status, reason, post_url, cleanup, diagnostics}` + CSV `status/reason/diagnostics_json` | `_build_write_result()` 자유형 dict, `stage` 문자열 ~15종, **`detail_code` 없음**, 예외 메시지 접두어(`editor_title_area_not_found:`, `CAPTCHA`)가 사실상 프로토콜 | 외주 우위 → 이식 3순위 |
| 단계 이벤트 | `_emit_event(stage, ok/fail, detail)` → `logs/events_YYYYMMDD.jsonl`, 비밀번호 redaction | 하트비트 `progress_stage` 5단계 + 콘솔 로그. 파일 이벤트 없음 | 이식 |
| 진단 번들 | 실패 시 allowlist zip(manifest/result/events/screenshot), `config/`·`accounts.json`·page_source 원천 차단, 바이트 스캔 | `debug/*.html|png` 로컬 보관, 오류보고엔 `recent_app_log`/traceback 텍스트만 | 이식(옵트인 첨부) |
| 잡 상한 타임아웃 | `BatchRunner._run_item` 워커 스레드 join(360초, GUI 2~60분 조정) → 초과 시 세션 강제 종료 + `TIMED_OUT` | 러너 전체 상한 없음. 서버가 45분 정체/10분 하트비트로 좀비 정리 | 이식 5순위 |
| 캡차 재시도 | opt-in 큐: 배치 끝나고 30분 쿨다운 후 최대 2라운드 재시도, 이벤트 기록 | 자동 재시도 없음(사용자 클릭 `/retry`, 3회 상한, 연속실패 가드) | 서버측 opt-in으로 이식 검토 |
| 셀렉터 헬스체크 | `scripts/selector_healthcheck.py`: 무자격 GET → 마커(`id="id"`, `loginBtn_column|row`, `btn_done`…) 검사 → PASS/FAIL/UNREACHABLE, launchd 매일 | 없음(사후 오류보고 분류만) | **이식 4순위(a)** |
| 셀렉터 관리 | 모듈 상단 상수 후보 리스트 ~530줄 + 텍스트 XPath + DOM 부수효과 검증. 외부 파일 없음 | `constants.py` 일부 + 모듈 로컬 리스트 + JS 리터럴 혼재. `config.yaml selectors:` 9키 로컬 오버라이드만 | 둘 다 없음 → 셀렉터 팩은 **새로 설계**(4순위(b)) |
| 오류 → 사람 루프 | Outbox zip을 Mac이 SSH로 회수(`triage_outbox.py`) → 리포트 | 오류보고 API → 정형 코드 1순위 자동 분류 → 안내 메일·티켓·텔레그램 | 예리 우위(서버가 있어서). 번들만 얹으면 된다 |
| 테스트 | pytest 232개(순수 함수·mock driver) | `tests/` 없음, `scripts/smoke_*` ~60개 | 외주 우위. 이식 항목은 순수 함수로 만들어 테스트 동봉 |
| 배포 | PyInstaller zip, Mac→SSH→의뢰인 PC 빌드, `git bundle` ff-only 업데이트, `BUILD_INFO.txt` 커밋 스탬프 | GH Actions 빌드 → 카탈로그 → 러너 최소 버전 preflight | 예리 우위. 참고할 것은 "빌드 커밋 스탬프를 결과 manifest에 넣기"뿐 |

---

## 3. 외주 소스가 실제로 하는 것 (코드 근거)

### 3-1. 전체 흐름
`gui.py::_batch_task` → `build_manuscript_batch_plan`(원고 폴더 `01아이디/01원고` 규칙) + `build_batch_execution_plan`(계정·프록시·예약시각) → `BatchRunner.run` → 항목별 워커 스레드에서 `PostingFlow.run` → `MinimalNaverFlow`(세션 재사용 → 로그인 → 블로그 존재 확인 → 작성창) → `NaverEditorService.execute_post`(제목·본문·이미지·지도·인용·표·대표사진·카테고리·예약·발행) → `_verify_publish` → `PostResult` → 실패 시 `create_diagnostics_bundle` → CSV/로그.

### 3-2. 로그인 (`naver/login.py`)
- `NaverBrowserSession.login()`: `resume_authenticated_session`(프로필 세션 → 쿠키 복원 → `sync_blog_session`) → 실패 시 로그인 페이지 → `send_keys` 입력(폴백 JS 주입) → 표시된 `button[id^='loginBtn']` 우선 클릭(`uc_click`) → 3.5~4.5초 → `_handle_device_confirm_interstitial`(URL에 `deviceconfirm`이면 `#new.dontsave`/`[id*='dontsave']`/텍스트 "등록안함" 클릭, 실패 시 네이버 메인 이동) → `classify_login_state`.
- `classify_login_state(url, page_source, title)` 순서: (1) URL `captcha|challenge` → CAPTCHA (2) URL `idsafetyrelease` → ACCOUNT_PROTECTED (3) URL `deviceconfirm` → ADDITIONAL_VERIFICATION (4) **URL이 naver.com이면서 nid/nidlogin 아님 → SUCCESS**(본문 문구보다 먼저 — 7/16 로그인된 메인의 "본인인증" 문구로 성공을 추가인증으로 오판한 사고 교훈) (5) nid 잔류 + 퀴즈 마커("보안을 위해 추가 확인", "정답을 입력", "영수증") → CAPTCHA (6) 불일치 마커 14종 → INVALID_CREDENTIALS (7) 보호조치 마커 12종 → ACCOUNT_PROTECTED (8) 추가인증 마커 10종 → ADDITIONAL_VERIFICATION (9) 캡차 마커 7종 → CAPTCHA (10) nidlogin/제목 "로그인" → FAILED (11) UNKNOWN. 각 결과에 `needs_manual_action`.
- 프로필 잠금 Chrome 종료는 PowerShell CIM(Windows 전용, 맥 no-op).
- 커밋 이력이 그대로 실패 학습 로그다: 7/16 `609d9ce`(loginBtn_column/row) → 7/17 `7bac3ce`(URL 우선 분류, 영수증 퀴즈) → 7/19 `027dc8a`(캡차 자동 재시도 큐) → 7/22 `b44a1a2`(deviceConfirm 자동 통과). **우리가 8/18에 만난 로그인 개편을 이 프로젝트는 7/16에 먼저 맞았고, 이후 3주간 4번의 후속 수정이 있었다.** 예리도 같은 후속을 만날 확률이 높다.

### 3-3. 에디터 (`naver/editor.py`, 상세는 부록 A)
- 본문은 **Windows 클립보드 CF_HTML + Ctrl+V**가 축(독스트링: execCommand insertHTML은 발행 시 사라진다, 실제 붙여넣기만 인라인 스타일이 살아남는다). 맥은 `sys.platform != "win32"` → 즉시 False → plain 타이핑 폴백.
- 셀렉터는 상수 후보 리스트 순회 + 텍스트 XPath 폴백 + **DOM 부수효과로 성공 판정**(텍스트 길이 증가·컴포넌트 수·이미지 수·토글 텍스트) 3층. 스코프 제한 클릭(`_click_element_by_text_within`, 달력·발행 레이어 안에서만) — 헤더 "임시저장 1" 버튼 오클릭 사고(7/22) 후 도입.
- 팝업: 자동저장 임시글 복원 팝업("작성 중인 글"+"이어서 작성" → 취소), 도움말 패널, 템플릿 교체 alert.
- 태그 입력 없음, 발행 후 검증은 editor 밖(post_flow)에서.
- 지연은 전부 고정값(랜덤 없음), 클릭은 대부분 JS click — 봇 회피는 드라이버(UC)에 위임.
- 단일 파일 5,019줄, `except Exception` 186회, `time.sleep` 145회.

### 3-4. 실패 처리·관측성 (`workflows/post_flow.py`, `batch_runner.py`, `diagnostics_bundle.py`)
- `PostStatus` 12종, `PostResult.diagnostics{stage, error_type, message, traceback, login{...}, blog_check{...}, write_entry{...}, browser{current_url, page_title, page_source_length, ready_state, screenshot_path}, verification_state, bundle_path}`.
- `_emit_event(stage, ok|fail, detail)` → `events_YYYYMMDD.jsonl`, 비밀번호 문자열 redaction.
- `_verify_publish`: 25초 폴링, `logno=` 있고 `redirect=write` 없으면 VERIFIED; 작성폼 URL이면 `[role=alert]/.se-popup-toast/...` 보이는 텍스트에 "오류|실패|발행할 수 없|잠시 후 다시" 등 → FAILED; 그 외 UNVERIFIED. **UNVERIFIED는 자동 재발행 금지**(중복 발행 방지).
- 진단 번들: allowlist만(manifest/result/events/screenshot), `config/` 경로·`accounts.json`·`page_source` 키 차단, 압축 전 바이트 스캔(`password`, `accounts.json`).
- 항목 타임아웃: 워커 스레드 `join(360)` → 살아있으면 `session.close()` 강제 + `TIMED_OUT`. GUI에서 2~60분 조정(8/11 동영상 6+사진 17 원고 초과 사례).
- 캡차 자동 재시도: opt-in, 배치 종료 후 30분(5~120분) 쿨다운, 최대 2라운드, `CAPTCHA_RETRY` 이벤트.

### 3-5. 운영 도구
- `scripts/selector_healthcheck.py`: 자격증명 없이 NID 로그인 폼 GET(Chrome UA) → HTML 5KB 이상·text/html 확인 → 마커 테이블(필수 `id="id"`, `id="pw"`; 제출 버튼 후보 중 하나) → PASS/FAIL/UNREACHABLE → `triage/logs/healthcheck.log`, launchd 매일.
- `scripts/triage_outbox.py`: SSH로 의뢰인 Outbox zip 회수 → ledger dedupe → 카테고리 집계 리포트(HTML/MD). 예리는 서버 오류보고 API가 이 역할을 이미 한다.
- 진단 스크립트 19개(`diagnose_*.py`): 실제 DOM을 관찰해 셀렉터를 확정하는 절차가 규칙("셀렉터 추측 금지, 먼저 진단 후 수정").

---

## 4. 우리보다 나은 지점 (이식 근거)

1. **로그인 실패를 7종으로 이름 붙인다.** 예리는 "NID에 머묾 → 수동 대기 180초 → 실패"라 비밀번호 오류·캡차 퀴즈·보호조치·새 기기 등록이 전부 같은 실패로 보이고, 서버 안내도 `naver_login_required` 하나로 뭉친다(8/18에 `naver_login_page_changed`를 겨우 분리). 외주본은 URL을 먼저 보고 문구는 나중에 봐서 오분류 사고(7/16, 7/17)를 두 번 겪고 고쳤다.
2. **발행 클릭과 게시 성공을 분리한다.** 예리 `publish_now()`는 확인 버튼 클릭 후 끝. "성공인데 미업로드"(외주 의뢰인 피드백 4번)와 같은 결함이 예리에도 잠재한다.
3. **결과가 데이터다.** `PostStatus`/`PostResult`/`diagnostics`가 스키마라 CSV·번들·리포트가 자동으로 나온다. 예리는 예외 문자열 접두어를 서버 정규식이 잡는 구조라 문구를 바꾸면 분류가 깨진다(실제로 `"CAPTCHA"` 키워드 보존 주석이 코드에 있음).
4. **깨지기 전에 안다.** 헬스체크는 로그인 폼이 바뀐 날 아침에 FAIL을 낸다. 예리는 사용자 실패 6건이 쌓인 뒤 오류보고로 알았다.
5. **한 건이 무한정 매달리지 않는다.** 항목 타임아웃이 로컬에서 6분 뒤 끊고 다음으로 간다. 예리는 서버 45분 stall 규칙까지 기다린다.
6. **스코프 제한 클릭.** 발행 레이어·달력 안에서만 텍스트 매칭. 예리 카테고리·확인 버튼 텍스트 스코어링은 전역이라 같은 오클릭 유형이 잠재한다.
7. **테스트가 있다.** 232개. 순수 함수(분류기·URL 판정·슬롯 계산)는 픽스처로 회귀를 잡는다.

## 5. 우리보다 못하거나 우리에게 안 맞는 지점 (도입 금지·보류)

| 항목 | 이유 | 판정 |
|---|---|---|
| SeleniumBase UC 스택 | 예리는 uc + selenium-stealth + 맥/윈 브라우저 탐색·프로필 복구·CDP 쿠키까지 이미 구현. 스택 교체는 전 흐름 회귀 검증(2 플랫폼 × 6 워커) 비용만 크고 탐지 회피 이득 근거 없음 | 금지 |
| Windows CF_HTML 클립보드·`ctypes` 파일 대화상자·`keybd_event`·PowerShell CIM | 전부 `win32` 가드 뒤. 맥에서 본문 서식·동영상 업로드가 사실상 죽는다(부록 A-7). 예리는 이미 맥 osascript/윈 CF_DIB 분기가 있다 | 금지 |
| 계정-프록시 1:1, IP 로테이션(adb 테더링·`api64.ipify.org` 확인) | 다계정 어뷰징 프레임. 예리는 사용자 본인 계정 1개. 계정 정지·서비스 약관 위험을 우리 제품이 떠안게 됨 | 금지 |
| incognito 기본 + 계정별 프로필 | 다계정 격리 목적. 예리는 영구 프로필로 세션 유지가 목표 | 안 맞음 |
| 원고 폴더 규칙·신호 태그(`[템플릿_N]`, `[대표_N]`, `[#카테고리_]`) | 예리 원고는 AI 생성 → 서버 artifact. 파서 계층 자체가 다름 | 안 맞음(대표사진·카테고리 "기능"만 참고) |
| customtkinter GUI, 배치 대시보드 | 예리 UI는 Tk/ttkbootstrap + 웹앱. 마스터플랜 문서(`AIMAX_Ultimate_Reliability_Masterplan.md`)의 Playwright 전환도 같은 이유로 이 로드맵에서 제외 | 안 맞음 |
| 고정 지연·JS click 위주 | 예리 human_type/실클릭이 더 자연스럽다 | 안 함 |
| `page_source` 문구 매칭 위주 상태 판정 | 외주본도 URL 우선으로 고쳤지만 여전히 한글 문구 30여 개에 의존. 이식 시 **URL·DOM 요소 존재를 1차, 문구는 2차**로 두고 마커는 데이터 파일로 뺀다 | 조건부 |
| 캡차 자동 재시도 | 보호조치 유발 가능. 외주본도 opt-in·2라운드 상한. 예리는 서버 연속실패 가드와 충돌하지 않게 설계 필요 | 조건부(Phase 5, 기본 OFF) |
| Mac→의뢰인 PC SSH 회수(`triage_outbox`) | 예리는 서버 API가 있음. 사용자 PC SSH는 불가·부적절 | 안 함 |
| 유지보수 부담 | editor.py 5,019줄 단일 파일, `except Exception` 186회 — 통째로 가져오면 예리 editor.py(1,806)+publisher(610)보다 부채가 커진다 | 통째 이식 금지 |

---

## 6. 이식 후보 상세 (우선순위·코드 스케치)

> 모두 "재구현". 함수·상수명은 예리 관례로 새로 짓는다. 시크릿 없음. 스케치는 방향 제시용이며 실제 셀렉터·마커는 라이브 DOM 관찰 후 확정한다(외주 CLAUDE.md 규칙과 동일).

### 6-1. 로그인 상태 분류기 (P1, 1~2 라운드)

- **무엇을**: `auth/naver_login.py`에 순수 함수 `classify_nid_state(url, title, page_source) -> LoginOutcome` 추가. `LoginOutcome(status: LoginStatus, reason: str, needs_manual_action: bool, detail_code: str)`. `LoginStatus = success | captcha | invalid_credentials | additional_verification | account_protected | page_changed | failed | unknown`. 판정 순서는 URL 우선(captcha/challenge → idSafetyRelease → deviceConfirm → nid 이탈=성공) → DOM 요소 존재(예: 퀴즈 입력칸, `#new.dontsave`) → 문구 마커(데이터 dict). `deviceConfirm`은 분류 전에 "등록안함" 자동 통과 시도.
- **왜**: 서버 안내가 정확해진다(비번 오류=사용자, 보호조치=사용자+안내, 페이지 변경=AIMAX, 캡차=재시도/수동). 연속실패 가드 서명(`classifyStructuredFailureSignature`)이 `naver_login_failed` 하나가 아니라 세분화된다.
- **어디에**: `auth/naver_login.py`(`_fresh_login`, `login_on_current_nid_page` 반환값을 outcome으로), `constants.py`(마커 테이블 → 6-4 셀렉터 팩으로 이동 예정), `app.py _worker_write` stage `naver_login`의 result에 `detail_code=login_<status>`, server.js `REPORT_STRUCTURED_JOB_GUIDANCE_RULES`에 `login_invalid_credentials`/`login_account_protected`/`login_additional_verification` 규칙 추가(현 `naver_login_required` 앞).
- **맥/윈**: 양쪽 OK(URL·DOM·문자열만).
- **검증**: HTML 픽스처(구 로그인 폼, 신 폼, deviceConfirm, 퀴즈, 보호조치, 로그인된 메인) 단위 테스트 ≥ 10건; 실계정 로그인 실기 1회(성공 경로만); server 분류 스모크 `smoke_report_auto_guidance_structured.mjs` 회귀 0.
- **위험**: 문구 마커 오탐(로그인된 메인의 "본인인증" 같은 일반 문구) → URL 성공 판정을 반드시 먼저.

```python
# auth/naver_login.py (스케치)
class LoginStatus(str, Enum):
    SUCCESS="success"; CAPTCHA="captcha"; INVALID_CREDENTIALS="invalid_credentials"
    ADDITIONAL_VERIFICATION="additional_verification"; ACCOUNT_PROTECTED="account_protected"
    PAGE_CHANGED="page_changed"; FAILED="failed"; UNKNOWN="unknown"

@dataclass(frozen=True)
class LoginOutcome:
    status: LoginStatus; reason: str; needs_manual_action: bool
    @property
    def detail_code(self): return f"login_{self.status.value}"

def classify_nid_state(url: str, title: str, page_source: str, markers=LOGIN_MARKERS) -> LoginOutcome:
    u = (url or "").lower()
    if "captcha" in u or "challenge" in u: return LoginOutcome(LoginStatus.CAPTCHA, "url:captcha", True)
    if "idsafetyrelease" in u:             return LoginOutcome(LoginStatus.ACCOUNT_PROTECTED, "url:idSafetyRelease", True)
    if "deviceconfirm" in u:               return LoginOutcome(LoginStatus.ADDITIONAL_VERIFICATION, "url:deviceConfirm", True)
    if "naver.com" in u and "nid.naver.com" not in u and "nidlogin" not in u:
        return LoginOutcome(LoginStatus.SUCCESS, "url:left_nid", False)
    src = (page_source or "").lower()
    for status, words in markers.ordered():          # quiz → invalid → protected → verification → captcha
        if any(w in src for w in words): return LoginOutcome(status, f"marker:{words[0]}", status is not LoginStatus.INVALID_CREDENTIALS)
    if "nidlogin" in u or "로그인" in (title or ""): return LoginOutcome(LoginStatus.FAILED, "stuck_on_login", False)
    return LoginOutcome(LoginStatus.UNKNOWN, "unclassified", True)
```

### 6-2. 발행 후 검증 (P2, 1~2 라운드)

- **무엇을**: `posting/publisher.py`에 `verify_publish(driver, timeout=25) -> PublishVerification(state, current_url, detail)`; `publish_now()` 뒤 호출. `state ∈ {VERIFIED, FAILED, UNVERIFIED}`. VERIFIED 조건: 현재(또는 새 탭) URL에 `logNo=`가 있고 `Redirect=Write`가 아님, 또는 `blog.naver.com/<id>/<숫자>` 패턴. FAILED: 작성폼 URL 잔류 + 보이는 alert/toast에 실패 문구. 그 외 UNVERIFIED. **UNVERIFIED는 재발행하지 않고 result에 `publish_unverified`로 남긴다**(사용자 안내: "블로그에서 글 존재를 확인하세요").
- **왜**: "done인데 글이 없다"를 잡는다. 서버 `imageCompletionIssue`처럼 done을 뒤집는 대신, 러너가 처음부터 `publish_unverified`를 보고하게 한다. 예약 발행은 URL 전환이 다를 수 있으니 예약 모드는 "예약 목록 확인" 또는 UNVERIFIED-scheduled로 별도.
- **어디에**: `posting/publisher.py`, `app.py _worker_write`(posts[] 항목에 `post_url`, `verification`), server.js `handleAgentJobUpdate`(`publish_unverified`를 done도 failed도 아닌 경고 상태로 표시하거나 failed_stage=publish_verify), 웹앱 잡 카드 표기.
- **맥/윈**: OK.
- **검증**: 임시저장 모드 스모크(발행 없음)로 UNVERIFIED 경로, mock driver로 VERIFIED/FAILED 단위 테스트, 실발행 1회는 CEO 승인 게이트 후.
- **위험**: 새 탭/리다이렉트 타이밍 오탐 → 25초 폴링 + 모든 window handle URL 검사.

### 6-3. 정형 결과 + 단계 이벤트 + 진단 번들 (P3, 2~3 라운드)

- **무엇을**:
  (a) `posting/result.py`(신규): `PostStatus` enum(success, draft_saved, login_failed, invalid_credentials, needs_manual_action, account_protected, write_entry_failed, editor_failed, publish_failed, publish_unverified, timed_out, page_changed…) + `WriteResult` dataclass → 기존 `_build_write_result()` dict에 `status`, `detail_code`, `stage`를 **표준 필드로 항상** 채움(기존 키는 유지, 병행).
  (b) `diagnostics/events.py`(신규): `emit(stage, ok|fail, detail)` → `APP_DATA/logs/events_YYYYMMDD.jsonl`, run_id 단위, 비밀번호·토큰 redaction(기존 `redaction.py` 재사용). 단계: `LOGIN → EDITOR_READY → CONTENT_FILLED → SUBMIT_SENT → VERIFY`. 하트비트 `progress_stage`와 동일 키를 쓴다.
  (c) `diagnostics/bundle.py`(신규): 실패 시 allowlist zip(manifest.json{app_version, build_commit, stage, status, detail_code, reason, current_url, page_title, run_id}, result.json, events.jsonl(run_id 필터), screenshot.png). 차단: `config.yaml`, `sessions/`, `browser_profiles/`, page_source 원문. 오류보고 다이얼로그에서 "진단 파일 첨부(옵션)"로 서버 업로드(크기 상한 2MB, 서버 `handleReport` multipart 또는 별도 엔드포인트).
  (d) server.js: `reportStructuredJobSignal`이 `result.detail_code`를 이미 1순위로 읽으므로 러너가 채우기만 하면 규칙이 붙는다. `REPORT_STRUCTURED_JOB_GUIDANCE_RULES`에 새 코드 매핑 추가.
- **왜**: 예외 문자열 프로토콜을 끊는다. 번들이 있으면 "로그에 없으니 시도 안 됐다"류 오판(외주 8/4 사례)을 피한다.
- **어디에**: `app.py _worker_write`(≈600줄 — 결과 조립부만 손댄다), `diagnostics/error_reporter.py`, `local_agent/worker_watchdog.py`(stage 키 공유), server.js.
- **맥/윈**: OK(경로는 `paths.py`).
- **검증**: 실패 유도 스모크(잘못된 비번 없이 — 에디터 iframe 미발견 유도 등) 후 서버 잡 `result.detail_code`·보고 자동분류 확인, 번들 zip 내부에 시크릿 바이트 0 확인 스캔 테스트.
- **위험**: 결과 스키마 변경이 서버 파서·웹앱 표기·Python 스윕(`aimax_report_auto_guidance.py`) 세 군데에 걸침 → 기존 키 유지 + 신규 필드 추가만.

### 6-4. 셀렉터 헬스체크 (P4-a, 1 라운드) + 셀렉터 팩 원격 갱신 (P4-b, 2~3 라운드)

- **(a) 헬스체크**: oracle 서버 systemd 타이머(또는 server.js 인터벌)로 하루 1~2회 NID 로그인 폼 GET(무자격, 쿠키 없음, HTML 미저장). 마커 테이블: 필수 `id="id"`, `id="pw"`, `frmNIDLogin`; 제출 후보 `loginBtn_column|loginBtn_row|log.login|btn_login` 중 ≥1; 금지 마커 변화 감지(예: `passkeyBtn` 신규 등장은 정보). 결과 FAIL이면 텔레그램 MF방 알림 + 자동화 티켓 `naver_login_page_changed` 선제 생성. 에디터 페이지는 로그인 필요라 무자격 GET 불가 — 대신 **러너가 성공한 잡의 `selector_hits`(어느 후보가 맞았는지 인덱스)를 result에 동봉**해 서버가 "1순위 후보 히트율 급락"을 관찰한다(외주본에도 없는 우리만의 추가).
- **(b) 셀렉터 팩**: `selectors/pack.json`(버전, 생성일, 최소 러너 버전, 항목별 후보 리스트 + 텍스트 폴백 라벨 + 로그인 마커 dict). 러너는 내장 팩을 기본으로, 기동·잡 claim 시 `GET /api/agent/selector-pack?runner=v1.0.x`로 상위 버전이 있으면 스키마 검증 후 `APP_DATA/selectors/pack.<ver>.json`에 저장·적용. 실패율이 오르면 서버가 `rollback_to` 지시. 서버 저장은 JSON 파일 + 관리자 API + 변경 이력. **스키마 검증 실패·서명 불일치 시 내장 팩 유지.** 외주 피드백 루프 전략 문서도 "자율 코드수정 반대, selector pack만 원격 갱신(스키마·테스트·롤백)"으로 결론냈다(`feedback-loop-strategy-20260714.md`).
- **왜**: 화면 변경 대응을 "러너 재빌드·재배포·사용자 업데이트"에서 "서버 JSON 갱신"으로 줄인다. 8/18 같은 사고를 실기 검증 후 수 시간 안에 닫을 수 있다.
- **어디에**: `constants.py`(팩 로더로 교체, `config.yaml selectors:` 오버라이드는 유지), `auth/naver_login.py`·`posting/editor.py`·`posting/publisher.py`(후보 리스트를 팩에서 읽기), `web_agent/client.py`, server.js.
- **맥/윈**: OK.
- **검증**: 팩 스키마 테스트, 잘못된 팩 주입 시 내장 팩 유지 테스트, 러너 스모크(팩 v+1 적용 후 로그인 버튼 탐색), 헬스체크 FAIL 알림 실측(마커 하나 일부러 빼고 dry-run).
- **위험**: 잘못된 팩이 전 사용자에 즉시 → 카나리(기기 라벨 1~2대 먼저) + 롤백 + 최소 러너 버전.

### 6-5. 잡 상한 타임아웃 (P5-a, 1 라운드) + 쿨다운 재큐 (P5-b, 1~2 라운드, opt-in)

- **(a)**: `_worker_write` 호출부(원격 잡 디스패치)에서 워커를 감시 스레드로 감싸 `join(limit)`; limit = 글 수·이미지 수 기반(기본 8분/글, 상한 30분). 초과 시 드라이버 `quit()` 강제 + `status=timed_out, detail_code=job_timeout, stage=<마지막 이벤트>`로 서버 보고. 서버 45분 stall보다 먼저 정형 실패가 도착해 연속실패 가드·안내가 즉시 동작한다.
- **(b)**: `LoginStatus ∈ {captcha, additional_verification}`로 실패한 잡은 서버가 `retry_after=now+30m`, `auto_retry_count<2`이면 자동 재큐(사용자 잡 카드에 "30분 후 자동 재시도" 표시). 기본 OFF(사용자·관리자 설정), 연속실패 가드와 별도 카운터, `account_protected`는 절대 재큐 안 함.
- **맥/윈**: OK.
- **검증**: 인위적 슬로우 워커로 타임아웃 경로 스모크, 서버 재큐 단위 스모크(`.mjs`), 재큐 상한 회귀.
- **위험**: 강제 종료 시 임시글 잔존(다음 진입 시 복원 팝업 — 이미 `_dismiss_draft_popup` 있음), 재큐가 보호조치 유발 → 상한 2회·기본 OFF.

### 6-6. 소규모 참고 항목 (각 0.5~1 라운드, Phase 3에 묶음)
- 카테고리: 발행 레이어 루트 스코프 안에서 토글 → 정확 텍스트 매칭 → 행 안 radio/label 클릭 → 토글 텍스트로 재검증, 결과 코드 `selected/missing/unavailable/unverified` → warnings로 보고.
- 확인/발행 버튼 텍스트 스코어링을 발행 레이어 스코프로 제한.
- 예약 시각 실패 시 10분 슬롯 올림 1회 재시도.
- 이미지 삽입 경로 순서(클립보드 vs DOM file input): 두 프로젝트 라이브 관찰이 상충 → 라이브 진단 1회 후 순서·타임아웃(45초 vs 14초) 재조정.
- 빌드 커밋 스탬프를 러너 result/manifest에 포함(외주 `BLOGPOSTAUTO_GIT_COMMIT` 방식) — 배포 커밋 대조 규칙과 맞물림.

---

## 7. 예리 디벨롭 로드맵 (Phase)

| Phase | 목적 | 범위 | 산출물 | 검증 기준 | 라운드 |
|---|---|---|---|---|---|
| 0 (선행) | 8/18 라운드 종결 | 서버 안내 배포 완료(8/18) → 실행기 v1.0.62 빌드 완료 · 카탈로그 등록 + 실계정 로그인 실기 잔여 | 배포본·검증 기록 | 실기 로그인 PASS, `naver_login_page_changed` 분류 라이브 1건 | 1~2 |
| 1 관측성 | 실패를 데이터로 | 6-3(a)(b) 정형 결과·단계 이벤트, 6-5(a) 잡 타임아웃, 빌드 커밋 스탬프 | `posting/result.py`, `diagnostics/events.py`, result 스키마 문서, 서버 규칙 매핑 | 실패 유도 스모크에서 서버 잡 `result.detail_code`·`stage` 채워짐, 기존 스모크 회귀 0, 타임아웃 경로 PASS | 2~3 |
| 2 로그인 견고화 | 로그인 실패 7종 분류 + 조기 경보 | 6-1 분류기·deviceConfirm 자동 통과, 6-4(a) 헬스체크, 서버 안내 규칙 세분화 | `classify_nid_state` + 픽스처 테스트, 헬스체크 타이머, 안내 문구 4종 | 픽스처 ≥10건 PASS, 실계정 성공 경로 1회, 헬스체크 FAIL 알림 dry-run 1회, `smoke_report_auto_guidance_structured` 회귀 0 | 2~3 |
| 3 발행·에디터 검증 | "성공인데 없음" 제거 | 6-2 발행 후 검증, 6-6 카테고리·스코프 클릭·예약 슬롯·이미지 순서 | `verify_publish`, publisher 스코프 리팩터, warnings 보고 | 임시저장 스모크로 UNVERIFIED 경로 PASS, mock VERIFIED/FAILED 단위 테스트, 실발행 1회(CEO 게이트) | 2 |
| 4 셀렉터 팩 | 화면 변경을 코드 배포 없이 흡수 | 6-4(b) 팩 스키마·로더·서버 API·카나리·롤백, `constants.py` 이관 | `selectors/pack.json` v1, 관리자 API, 롤백 절차 문서 | 잘못된 팩 주입 시 내장 팩 유지, 팩 v+1로 로그인 버튼 탐색 PASS(맥·윈 각 1회), 카나리 1대 실측 | 2~3 |
| 5 자동 복구 | 사람 개입 전 1차 회복 | 6-5(b) 쿨다운 재큐(opt-in), 6-3(c) 진단 번들 옵트인 첨부 | 서버 재큐 정책, 번들 업로드 경로 | 재큐 상한·보호조치 제외 스모크, 번들 시크릿 스캔 0건 | 1~2 |
| 6 구조 분리 (별도 승인) | 부채 축소 | `_worker_write`를 `posting/flow.py::PostingFlow`로 추출(UI StringVar 의존 제거, 헤드리스·테스트 격리), pytest 스위트 도입 | 클래스 분리, 테스트 20+ | 기존 스모크 전부 PASS, 헤드리스 `--agent` E2E PASS | 3~5 |

합계(0 제외, 6 제외): 9~13 라운드. 게이트는 날짜가 아니라 이벤트(각 Phase 검증 PASS + CEO 확인). 사람 대기 구간: Phase 0 실기 로그인(사용자 계정), Phase 3 실발행 승인, Phase 4 카나리 사용자 선정.

---

## 8. 잔여 위험·미확정

- **소유권**: 용역 계약서의 IP 조항 미확인. 재구현 원칙으로 회피하되, 조항이 "산출물 일체 양도"면 이 보고서의 스케치 수준(공개 기법·표준 패턴)만 사용한다.
- **상충 관찰**: 이미지 삽입 경로(file input 유무)는 두 코드베이스의 라이브 관찰이 다르다. 실측 전 순서를 바꾸지 않는다.
- **외주본도 미검증 구간이 있다**: 대표사진+템플릿 조합, above 삽입 위치, blog_url≠id 경로(`backlog-code-crosscheck-20260730.md` 2·4절). 이 부분은 참고하지 않는다.
- **예리 서버 저장소**: JSON 파일 + 무락 read-modify-write. 재큐·팩 API를 얹어도 단일 프로세스 전제는 그대로다(별도 과제).
- **이 분석은 정적**: 실행·로그인·발행을 하지 않았다. 셀렉터·마커 문자열은 라이브 DOM 관찰 후 확정한다.

---

## 부록 A. editor.py 정적 분석 요약 (외주)

<details>
<summary>펼치기 — 드라이버·에디터 조작·셀렉터·실패 처리·맥 비호환</summary>

**A-1 드라이버**: SeleniumBase `Driver(uc=True, headless=False, incognito=True, locale_code="ko", user_data_dir, chromium_arg="profile-directory=…", proxy)`; 내비게이션 `uc_open_with_reconnect → default_get → get`. 별도 스텔스 패치 없음. `editor.py`는 드라이버를 만들지 않고 `driver: Any`를 인자로 받음(selenium은 함수 내 지연 import).

**A-2 진입**: `write_entry.build_write_page_candidates()` 4개 URL, `open_write_page()` 후보 순회 → mainFrame 전환 → `classify_write_entry()`(READY 마커: mainFrame/se-help-panel-close-button/se-toolbar-item-map/publish-option-search/스마트에디터). `execute_post()` 독스트링 "Do NOT call switch_to.default_content()". 발행/임시저장 버튼만 현재→default→mainFrame 3단 재탐색.

**A-3 입력**: 제목 ActionChains 클릭 + Ctrl+A/Del + send_keys + Enter. 본문 `_runs_html()`→`_paragraph_html()`→`_paste_fragment()`: `_set_clipboard_html()`(ctypes user32/kernel32 `RegisterClipboardFormatW("HTML Format")`, `sys.platform!="win32"`면 False) + `_focus_body_end()` + Ctrl+V, `_editor_text_length()` 증가 폴링(5~15초). 폴백 send_keys 통째. execCommand 미사용. 숨은 SEO 제목(흰 글자 1px) 붙여넣기 전용. 인용구 HTML 붙여넣기 → 툴바 → 타이핑 3단. 표 HTML → 그리드 `[data-row][data-col]` → Tab 타이핑. oglink 팝업 input `_set_react_input_value` + Enter + 프리뷰 대기. 지도 검색 input → 딤 pointer-events none → 결과 클릭 → 추가 → 확인 → `.se-placesMap` 카운트 3중 신호. 이미지 버튼 실클릭 → DOM `input[type=file]` send_keys → Windows 대화상자 폴백, 45초 검증, 3회. 동영상은 대화상자 먼저(맥 불가) → DOM input 폴백 → "업로드 완료" 폴링. 대표사진 본문 이미지 hover→[대표] 클릭→인덱스 검증, 라이브러리 패널 폴백. 카테고리 발행 레이어 루트 스코프 토글→정확 매칭→radio/label→재검증. 예약 라디오→달력 컨테이너 내부만→시/분 5단 폴백→10분 슬롯 올림. 발행 `_publish()` JS 클릭 → 옵션 → `_confirm_publish_dialog()`; 발행 후 검증은 post_flow. 태그 입력 없음.

**A-4 셀렉터**: 모듈 상단 상수 리스트 ~530줄. 예: `_IMAGE_UPLOAD_MENU`(9후보), `_CATEGORY_TOGGLE_SELECTORS`(10후보, `[class*='category']` 계열), `_PUBLISH_SELECTORS`(5후보). 후보 순회 + `is_displayed/is_enabled` + 텍스트 XPath 폴백 + DOM 부수효과 성공 판정 + 스코프 제한 클릭. 헬스체크 훅·외부 파일·히트 로깅 없음. 넓은 부분 매칭 오탐 사고 주석 다수.

**A-5 실패 처리**: 재시도 이미지 3/동영상 3/지도 2/숨은제목 2/클립보드 5, 고정 백오프. 타임아웃 상수 다수. 스크린샷은 세션 계층. `_append_warning(settings,…)`로 경고 역전달. stage 이벤트·info 로깅 없음. 팝업: 임시글 복원·도움말·템플릿 alert·ESC·딤 무력화. `except Exception` 186회.

**A-6 봇 회피**: 지연 전부 고정, 클릭 대부분 JS, `random`은 이미지 선택 1곳. 회피는 UC에 위임. login.py만 `random.uniform` 지연.

**A-7 맥 비호환**: (1) 클립보드 CF_HTML → 본문 서식·숨은제목·표·hr 폴백 붕괴 (2) `Keys.CONTROL` 하드코딩(제목 Ctrl+A, Ctrl+V, Ctrl+B) (3) 파일 대화상자 `#32770`/`EnumWindows`/`SetForegroundWindow`/`keybd_event` win32 가드 (4) 동영상 대화상자 우선 → 맥 대응 수단 없음 (5) PowerShell CIM 프로필 잠금 정리 no-op (6) `pyproject` extras 이름 `windows-runtime`. 경로·드라이브 하드코딩은 없음.

**A-8 규모**: 5,019줄, 함수 198개, 클래스 1개(`NaverEditorService` ~1,380줄), 중복(발행/임시저장 버튼 탐색, 팝업 제외 셀렉터 JS 5회 반복, `_type_title` 본체 2회), 하드코딩(색·px·폰트·10열 그리드·`.mp4`). 순수 함수는 테스트 가능, JS 문자열·sleep은 mock 불가.
</details>

## 부록 B. 예리 현재 구조 요약 (우리)

<details>
<summary>펼치기 — 드라이버·로그인·에디터·셀렉터·실패 처리·서버 큐</summary>

**B-1 드라이버** `browser/stealth_driver.py`: uc → Selenium 폴백(`driver_mode auto/undetected/selenium`), 랜덤 창 크기, `--disable-blink-features=AutomationControlled`, selenium-stealth(platform 맥/윈/리눅스 분기), 영구 프로필 `APP_DATA/browser_profiles/default`, SingletonLock 정리·잔여 chrome kill(맥 pgrep/윈 PowerShell), 손상 프로필 백업 재생성, 드라이버 캐시. 쿠키 `sessions/<id>_cookies.json`(0600, 30일), CDP `Network.setCookie` 복원 우선. 붙여넣기 modifier `Keys.META`(Darwin)/`CONTROL`.

**B-2 로그인** `auth/naver_login.py`(375줄): 세션 fast path(`has_recent_session_file` + `_blog_session_ready`) → CDP 복원 → `_fresh_login`(JS value 주입 + input 이벤트 → 버튼 → `nidlogin.login` 잔류면 실패) → RuntimeError면 `_wait_for_manual_login` 180초 → `sync_pc_blog_login`. 에디터 진입 중 NID면 `login_on_current_nid_page`(JS → 클립보드 → sync → 수동, 예외 문구에 "CAPTCHA" 보존). 버튼 후보 `LOGIN_BUTTON_SELECTORS` 5개 + 보이는 것 우선 + 폼 내 "로그인" 라벨 스캔(passkey 제외, 8a400bd). 캡차/새기기/2단계/보호조치 전용 판정 없음.

**B-3 에디터** `posting/editor.py`(1,806) `publisher.py`(610): `GoBlogWrite.naver` → NID면 재로그인 → 직접 URL 4후보 → `ensure_editor_context` iframe 6종. 임시글 팝업 8초 폴링(8후보 + 라벨 JS), 도움말 4종 → display:none. 제목 클립보드3→human_type2→execCommand2 + `_read_title_text` 검증. 본문 human_type, 링크 클립보드, 인용구 실패 시 일반 텍스트. 이미지 AI 생성 → 클립보드 붙여넣기(맥 osascript TIFF/윈 CF_DIB) → 버튼+file input 폴백, DOM img 카운트 14초. 카테고리 `[class*='category'] button` 전역, 경고만. 임시저장 11후보 + 토스트/aria-label/autosave 3중 확인, 미확인 시 실패. 발행 5후보+텍스트 → 확인 버튼 스코어링 → alert 수락, **게시 확인 없음**. 예약 datepicker 24개월·오클릭 방지·Select 검증·분 랜덤. 태그 없음.

**B-4 셀렉터**: `constants.py` 상수(CSS 모듈 해시 클래스 다수: `.save_btn__bzc5B`, `.publish_btn__m9KHH`, `.layer_publish__vA9PX`…) + 모듈 로컬 후보 리스트 + JS `querySelector` 리터럴(editor 14, publisher 5). `config.yaml selectors:` 9키 로컬 오버라이드. 원격 갱신 없음(러너 최소 버전 preflight만).

**B-5 실패 처리**: 브라우저/로그인 1회 재시도, 글별 발행 2회(특정 stage+세션 오류만), 잡 상한 없음. `debug/*.html|png` 로컬. result `{ok, success, total, mode, usage, images{…failures[]}, posts[], failed_posts[], stage, failed_keyword, cost, error}` — `detail_code` 없음. 하트비트 20초 `progress_stage` 5단계, watchdog(claim 후 30초 워커 미기동 → 실패 보고 + 윈도우 자가 재시작). 오류보고 마스킹 후 `/api/reports`, 오프라인 pending flush.

**B-6 서버** `server.js`(19,055): 상태 queued/generating/ready_for_publish/running/done/failed/cancelled. `handleCreateJob`(연속실패 가드 → 러너 버전 preflight → 서버생성 여부 → 키워드 분리 N잡 + stagger). 서버 글 생성 Gemini 체인/OpenAI/Claude → artifact. `handleAgentNextJob` claim(락 없음, +24h). `handleAgentJobUpdate`(done인데 이미지 부족이면 failed 뒤집기). 좀비: 3분 시작 미보고, 하트비트 10분 grace, 45분 정체. 재시도 사용자 클릭 3회, 연속실패 서명 3회 차단. 오류보고: `attachServerJobSnapshot`(48h, 3잡) → `reportStructuredJobSignal`(72h, `detail_code/error/stage/failed_reason/visible_error/diagnostic.code/마지막 error 로그`) → 규칙 순서(ai_response_invalid → … → naver_login_page_changed → naver_login_required → runner_update_required → provider_transient) → 자유텍스트 폴백 → 5분 스윕 안내 메일(users.json 정본 이메일).

**B-7 규모**: app.py 8,057(`NaverBlogApp` 단일 클래스, `_worker_write` ~600줄, UI StringVar 직접 읽음), tests 없음(스모크 ~60개), CI는 빌드만.
</details>

## 부록 C. 외주 저장소 파일·커밋 이력

<details>
<summary>펼치기</summary>

- 루트: 레거시 `블로그포스팅_공생.exe/.pdb/.xml/.config`, Selenium .NET dll 8종, `adb.exe`+`AdbWinApi.dll`+`AdbWinUsbApi.dll`, 견적서 PDF 2종, `generate_quote*.py`, `test_naver_login.py`.
- `src/blogpostauto/`: `cli.py`(paths/doctor/parse-manuscript/plan-manuscripts/smoke-login/bootstrap/smoke-write-entry/smoke-draft), `gui.py`, `scheduling.py`, `runtime_paths.py`(LOCALAPPDATA 우선), `diagnostics.py`(Chrome 버전·CfT 매칭), `diagnostics_bundle.py`, `domain/models.py`, `parsing/{manuscript,signals,imports}.py`, `naver/{login,editor,write_entry,bootstrap}.py`, `workflows/{post_flow,batch_runner,batch_plan,minimal_naver_flow,legacy_flow,completion}.py`.
- `scripts/`: diagnose_* 14종, `selector_healthcheck.py`, `triage_outbox.py`, `verify_representative_publish.py`, `verify_template_live.py`, `inspect_template_scripts.py`.
- `deploy/`: `windows-ssh/winctl.sh`(doctor/setup/pull/build/smoke/exec/fetch/push-bundle), `mac-triage/*.plist`, `client-onboarding/`.
- `claudedocs/specs/`: batch1 parsing, batch2 editor DOM, batch3 verify+bundle, captcha auto retry, outbox triage, selector healthcheck.
- 커밋(발췌, 최신순): 868e047 증거 위치 기록 → e276818 GUI 항목 타임아웃 → fb76e75 카테고리 라디오+성공 시 경고 표시 → e00eae9 대표사진 발행 검증 → 6eee1ce 본문 이미지 기준 대표 → e20497b bundle 기반 ff-only 업데이트 → a436c74 첫줄 태그 조합 → b2ee9c7 이미지 DOM file input 우선 → b44a1a2 예약 datepicker 스코프 + deviceConfirm → 5ba8db2 셀렉터 헬스체크 → 671dacf outbox 트리아지 → 027dc8a 캡차 자동 재시도 큐 → 7bac3ce URL 우선 로그인 분류 → 609d9ce 신 로그인 UI 버튼 → da96fa7 발행 후 검증+stage 이벤트+진단 번들 → 3a6d504 대표이미지·카테고리 → 0798777 마커 파싱.
- 실사용 근거: 7/31 신버전 46건 전량 성공(45건 배치 reason 전부 "발행 완료"), 구버전 32건 중 publish_unverified 3·캡차 1(`backlog-code-crosscheck-20260730.md` 4-3).
</details>

## 부록 D. 라이선스·시크릿 메모

- 저장소 `.gitignore`가 `/BlogPostAuto/`, `*.log`, `/triage/`를 제외. `config/accounts.json`(계정·비번·프록시)은 의뢰인 PC에만 존재하며 저장소·본 보고서에 값 없음. `deploy/windows-ssh/targets/*.conf`에 Tailscale IP·사용자명(문서에도 노출) — 인용하지 않음. 테스트 계정은 Mac Keychain 항목 이름만 문서에 있고 값은 없음.
- 견적서에 소유권 조항 없음. 유지보수 계약 별도 표기. 계약서 원문 확인 필요.
