# AIMAX Local Agent 전용화 Phase L0 정리

작성일: 2026-05-05

이 문서는 `docs/local_agent_transition_handoff.md`를 기준으로 새 세션 시작 전에 다시 확인한 제품 경계, 보안 계약, AI Council 의견, 코드 결합 지점, 다음 phase 진입 기준을 정리한다.

## 1. 현재 최우선 문제

설치 파일을 실행했을 때 기존 Python/Tkinter 전체 UI가 뜨면 AIMAX는 웹앱 본체가 아니라 기존 프로그램의 보조 대시보드처럼 보인다.

따라서 지금 우선순위는 웹앱 UI 추가가 아니라 아래 제품 경계로 실행기를 바로잡는 것이다.

```text
웹앱 = 사용자가 보는 본체, control plane
서버 = 계정/권한/작업 큐/기기 상태/오류/업데이트 관리
Local Agent = 화면 없는 백그라운드 실행기, data plane
사용자 PC = 네이버 로그인, 쿠키, AI API Key, Chrome/Selenium 실행 위치
```

## 2. 보안 계약

서버에 저장하거나 로그로 남기면 안 되는 값:

- 네이버 비밀번호
- 네이버 쿠키/세션
- Gemini API Key
- Claude API Key
- 긴 인증 토큰 원문
- Chrome profile 내부 민감 데이터

서버에 저장 가능한 값:

- 사용자 이메일
- 상품 권한: `yeri`, `hyunju`, `bundle`
- 기기 ID, 기기 표시명, 등록 상태
- Agent 버전/플랫폼/마지막 연결 시간
- readiness 상태
- redacted job payload
- redacted 오류 보고 요약/로그

로컬 저장 기준:

- macOS는 Keychain
- Windows는 DPAPI 또는 Windows Credential Manager
- 평문 JSON에 네이버 PW/API Key 저장 금지
- 오류 보고/로그 전송 전 마스킹 필수

## 3. AI Council 반영

실행 결과:

- 실행 위치: `council-runs/20260505-211405-aimax-naverblogauto는-현재-웹앱-control-plane-사용자-pc-`
- Claude: 성공
- Gemini: 성공

공통 결론:

- 웹앱 control plane, Local Agent data plane 분리는 맞다.
- 민감정보는 서버를 배제하고 로컬 Keychain/DPAPI에 둔다.
- 한 번에 Tkinter와 worker를 완전 분리하면 회귀 위험이 크다.
- L1에서는 먼저 사용자에게 전체 UI가 보이지 않게 하는 작은 agent mode부터 만든다.

Claude가 강하게 짚은 위험:

- worker가 `StringVar`, `IntVar`, `root`, `log_text`, `progress_var` 같은 Tkinter 객체에 묶여 있다.
- 현재 Agent heartbeat/job polling은 사용자 session token 기반이다. device/agent token 분리는 L5에서 반드시 필요하다.
- L3의 localhost bridge는 HTTPS 웹앱에서 mixed content/CORS/private network access 문제를 미리 검토해야 한다.

Gemini가 강하게 짚은 위험:

- 성급한 대규모 분리로 기존 예리/현주 자동화 로직을 깨뜨리면 안 된다.
- 필요하면 1차에서는 내부 Tk root를 숨기는 방식도 허용하되, 전체 UI는 사용자에게 보이면 안 된다.
- 기존 개발용/legacy UI는 `--legacy-ui`로 보존한다.

Codex 판단:

- L1은 `--agent` 실행 진입점을 추가하되, worker 완전 분리는 L4로 미룬다.
- 현재 사용자 session token 방식은 L1 smoke에는 허용하되, 일반 배포/자동 시작 완성 전에는 L5 device token을 별도 phase로 반드시 진행한다.
- `open_settings` 명령은 headless agent에서는 기존 Tk 설정 화면을 열 수 없으므로, L1에서는 `failed` 또는 "웹앱/로컬 설정 bridge 미지원" 상태를 명확히 반환하고, L3에서 localhost settings endpoint로 전환한다.

## 4. 코드 확인 요약

확인한 주요 파일:

- `app.py`
- `split_version/app.py`
- `web_agent/client.py`
- `oracle/aimax-reports-api/server.js`
- `build.py`
- `packaging/windows/aimax_installer.iss`

현재 결합 지점:

- `app.py`의 `__main__`은 항상 `NaverBlogApp()`을 만들고 `run()`으로 전체 UI를 연다.
- `NaverBlogApp.__init__`은 시작 즉시 Tk root, consent dialog, UI panel, log panel, onboarding을 구성한다.
- `_web_agent_loop`, `_collect_web_agent_readiness`, `_start_remote_job`, `_worker_remote_job`는 이미 존재하지만 UI 객체와 같은 클래스 안에 있다.
- `_worker_write`, `_worker_neighbor`는 웹 job에서 호출 가능하지만 내부에서 `self.naver_id_var`, `self.naver_pw_var`, `self.api_key_var`, `self.ai_model_var`, `self.progress_var`, `self.queue`, `self.driver`, `self.stop_event`를 사용한다.
- `_poll_queue`, `_start_worker`, `_on_worker_done`은 `log_text`, `progress_var`, root child widgets에 의존한다.
- 서버는 `/api/agent/heartbeat`, `/api/agent/next-job`, `/api/agent/next-command`, `/api/agent/jobs/update`를 제공하지만 agent 전용 device token은 아직 없다.
- Windows installer는 설치 후 `{app}\{#AppExeName}`를 실행하도록 되어 있어, 현재 구조라면 설치 직후 기존 UI가 열린다.

## 5. Phase L1 진입 기준

L1의 목적:

- `python app.py --agent` 실행 시 기존 전체 Tkinter UI가 보이지 않는다.
- 저장된 웹앱 session token이 있으면 heartbeat/job polling을 시작한다.
- token이 없으면 조용히 "pairing/login 필요" 상태로 종료하지 않고 대기하거나 로그를 남긴다.
- `python app.py --legacy-ui` 또는 기존 개발 실행에서는 전체 UI를 열 수 있다.

L1에서 하지 않을 일:

- worker 전체 리팩터링
- 서버 device token 완성
- 웹앱에서 네이버 PW/API Key를 입력받아 서버를 경유하는 구조
- Windows 자동 시작부터 수정
- 기존 예리/현주 자동화 로직 변경

L1 구현 단위:

1. CLI/env gate 추가: `--agent`, `--legacy-ui`, `AIMAX_AGENT_MODE=1`, `AIMAX_LEGACY_UI=1`
2. headless agent runtime 추가: UI build 없이 settings/keyring/readiness/web polling만 실행
3. queue/log/progress를 headless에서도 동작하게 adapter 처리
4. `open_settings` command는 L3 전까지 headless 미지원으로 명확히 응답
5. `python app.py --agent` smoke: 전체 UI 미표시, heartbeat 시도, token 없음/있음 동작 확인
6. 기존 `python app.py --legacy-ui` smoke: 전체 UI 정상 표시

## 6. 다음 결정 게이트

L0는 이 문서와 `docs/local_agent_transition_handoff.md`로 동결한다.

다음 단계는 L1A, 즉 macOS 개발 환경에서 `app.py --agent`를 먼저 구현하고 smoke하는 것이다.

L1A를 통과하기 전까지 macOS/Windows 설치파일 재빌드나 운영 업로드는 하지 않는다.

## 6.1 신규 사용자 설치 안내 필수 요구사항

첫 사용자들은 설치 직후 아래 문제를 가장 먼저 겪을 수 있다.

- macOS Gatekeeper 경고
- 다운로드한 앱 실행 차단
- 보안 및 개인정보 보호에서 앱 허용 필요
- Chrome/Selenium 실행 권한 또는 자동화 관련 허용
- Windows SmartScreen 경고
- 백그라운드 실행/로그인 항목/시작 프로그램 허용
- 방화벽 또는 백신이 실행기를 차단하는 상황

따라서 Local Agent 설치 배포 전 반드시 아래 산출물을 만든다.

- Notion 가이드: macOS/Windows별 설치, 실행 허용, 권한 승인, 문제 해결 스크린샷/단계
- 웹앱 설치/업데이트 탭 팝업: 설치 전후에 사용자가 가이드를 바로 열 수 있는 안내
- 다운로드 버튼 주변 링크: "설치가 막히나요? 권한 허용 가이드 보기"
- Local Agent 최초 연결 실패/미연결 상태에서 같은 가이드 링크 표시

Notion 작성은 destination을 확정해야 하므로, 실제 작성 직전에 사용할 workspace/database/page를 확인한다.

## 7. Phase L1A 진행 기록

2026-05-05 진행:

- `local_agent/runtime.py` 추가
  - Tkinter UI 없이 기존 worker 메서드가 필요로 하는 최소 상태 adapter 제공
  - `HeadlessVar`로 `StringVar`/`IntVar`류 접근을 대체
  - headless queue/log/progress/worker lifecycle 처리
  - headless mode의 `open_settings`는 L3 bridge 전까지 명확히 `failed`로 응답
- `app.py`에 `--agent`, `--legacy-ui`, `AIMAX_AGENT_MODE=1`, `AIMAX_LEGACY_UI=1` gate 추가
- `split_version/app.py`에도 같은 headless runtime 연결
- `split_version/app_find.py`, `app_engage_write.py`, `app_write.py`, `app_engage.py` 진입점도 agent mode를 인식하도록 수정
- PyInstaller/Nuitka 등 frozen 실행파일은 기본적으로 headless agent mode로 실행되도록 gate 보강
- `build.py`, `split_version/build_split.py`에 `local_agent` hidden import/collect-submodules 추가

검증 완료:

- `venv/bin/python -m py_compile app.py split_version/app.py split_version/app_find.py split_version/app_engage_write.py split_version/app_write.py split_version/app_engage.py build.py split_version/build_split.py local_agent/__init__.py local_agent/runtime.py web_agent/client.py`
- `AIMAX_AGENT_ONCE=1 ... venv/bin/python app.py --agent`
  - 기존 Tkinter UI 미표시
  - 저장된 웹앱 세션 없음 상태를 headless 로그로 표시
- frozen 실행파일 agent-mode gate 단위 테스트
  - dev Python 기본값은 legacy UI
  - `sys.frozen=True` 시 기본값은 agent mode
- `AIMAX_AGENT_ONCE=1 ... venv/bin/python split_version/app_find.py --agent`
  - 기존 Tkinter UI 미표시
- `AIMAX_AGENT_ONCE=1 ... venv/bin/python split_version/app_engage_write.py --agent`
  - 기존 Tkinter UI 미표시
- GUI 권한 승인 후 legacy UI smoke
  - `NaverBlogApp()` 생성, UI build, 짧은 mainloop, destroy 통과
- fake client/fake worker remote dispatch smoke
  - `yeri_write` 웹 job이 기존 `_worker_write` 인자로 전달됨
  - `hyunju_find` 웹 job이 기존 `_worker_neighbor` 인자로 전달됨
  - job 상태 업데이트 순서 `running -> done` 확인
- split headless gating smoke
  - `find` 실행기는 `yeri_write`를 `failed` 처리
  - `engage_write` 실행기는 `hyunju_find` readiness를 `unavailable`로 표시
- headless `open_settings` command smoke
  - 기존 UI를 열지 않고 `failed` command update를 전송

남은 L1B:

- 저장된 실제 웹앱 session token이 있는 환경에서 heartbeat/next-job polling을 운영 API 기준으로 확인
- build entry가 기본적으로 agent mode로 실행되도록 macOS/Windows 패키징 진입점 조정
- 설치 파일 재빌드 전, 실제 네이버 작업을 실행하지 않는 운영 API E2E smoke 재수행

## 8. Phase L1B 진행 기록

2026-05-05 진행:

- 신규 사용자 설치 안내 필수 요구사항을 `6.1`에 고정
  - macOS Gatekeeper/보안 허용
  - Windows SmartScreen/백신/시작 프로그램 허용
  - 웹앱 팝업과 다운로드 주변 링크
  - Notion 가이드 작성 필요
- `scripts/headless_agent_polling_smoke.py` 추가
  - 로컬 fake AIMAX API 서버를 띄워 headless polling loop를 E2E로 검증
  - 운영 API나 실제 네이버 계정에 접속하지 않음
  - 최종 네이버 자동화 worker는 test double로 대체

검증 완료:

- `venv/bin/python -m py_compile app.py split_version/app.py split_version/app_find.py split_version/app_engage_write.py split_version/app_write.py split_version/app_engage.py build.py split_version/build_split.py local_agent/__init__.py local_agent/runtime.py scripts/headless_agent_polling_smoke.py web_agent/client.py`
- `venv/bin/python scripts/headless_agent_polling_smoke.py`
  - heartbeat 2회 전송 확인
  - headless `open_settings` command가 `failed`로 안전 처리됨 확인
  - `yeri_write` job이 `running -> done`으로 업데이트됨 확인
  - `hyunju_find` job이 `running -> done`으로 업데이트됨 확인
  - 기존 `_worker_write`, `_worker_neighbor`로 전달될 인자 mapping 확인
- `AIMAX_AGENT_ONCE=1 ... venv/bin/python app.py --agent`
  - 통합 실행기 headless 시작 확인
- `AIMAX_AGENT_ONCE=1 ... venv/bin/python split_version/app_find.py --agent`
  - 현주 실행기 headless 시작 확인
- `AIMAX_AGENT_ONCE=1 ... venv/bin/python split_version/app_engage_write.py --agent`
  - 예리 실행기 headless 시작 확인

남은 L1C:

- 실제 운영 API 계정/session을 사용한 smoke
- 설치 파일 재빌드 전 패키징 진입점/설치 후 실행 동작 확인
- 웹앱 업데이트/설치 화면에 권한 가이드 팝업과 링크 추가

## 9. Phase L1C 진행 기록

2026-05-05 진행:

- Notion 프로젝트 DB에 설치 권한 가이드 작성
  - 페이지: `AIMAX 설치 및 실행 허용 가이드`
  - URL: `https://www.notion.so/357b31f1da558132914cd2f40053d66a`
  - 포함 범위: macOS Gatekeeper/보안 허용, Windows SmartScreen/백신 허용, 브라우저/자동화 권한, 첫 연결 실패 시 확인 순서
- Notion 가이드를 사용자용 문서로 재작성
  - 내부 handoff/architecture 표현 제거
  - 처음 설치하는 사용자를 기준으로 다운로드, 실행, 보안 허용, 웹앱 연결 확인까지 단계화
  - Apple/Microsoft 공식 도움말 링크를 하단에 추가
- 웹앱 로컬 실행기 다운로드 영역에 가이드 링크 추가
  - 대시보드 `로컬 실행기` 패널
  - 업데이트 탭 `설치 파일` 패널
- 설치 파일 다운로드 성공 직후 첫 실행 권한 안내 팝업 표시
  - 팝업에서 Notion 설치 권한 가이드를 바로 열 수 있음
- headless agent 안전 smoke용 `AIMAX_AGENT_HEARTBEAT_ONLY=1` 모드 추가
  - heartbeat와 readiness만 전송
  - command/job 큐를 소비하지 않음
  - 운영 API 연결 확인 시 실제 자동화 작업을 건드리지 않기 위한 안전장치
- `scripts/save_web_agent_session.py` 추가
  - AIMAX 웹앱 계정으로 로컬에서 로그인
  - session token은 채팅/문서에 노출하지 않고 OS credential store에 저장
  - headless agent 운영 heartbeat smoke 전 session bootstrap 용도
- `scripts/agent_heartbeat_only_smoke.py` 추가
  - 저장된 웹앱 session token으로 실제 AIMAX API에 heartbeat 전송
  - `AIMAX_AGENT_HEARTBEAT_ONLY=1`을 기본 적용해 command/job 큐를 소비하지 않음
  - `/api/agent/status`로 연결 상태와 agent version을 확인

남은 L1C:

- 실제 운영 API 계정/session을 사용한 heartbeat-only smoke
- 설치 파일 재빌드 전 패키징 진입점/설치 후 실행 동작 확인
- macOS/Windows 설치 파일 재빌드 후 다운로드-실행-연결 검증

2026-05-05 추가 검증:

- 로컬 웹앱 session token 존재 여부 확인
  - 결과: `token-missing`
  - session token은 채팅으로 전달하지 않고 `scripts/save_web_agent_session.py`를 사용해 로컬 OS credential store에 저장해야 함
- 운영 heartbeat-only smoke dry run
  - 저장 세션 없음으로 정상 차단
  - 안내 명령: `venv/bin/python scripts/save_web_agent_session.py --email <email>`
- 패키징/진입점 gate 검증
  - dev Python 기본 실행: legacy UI 유지
  - `--agent`: headless mode
  - frozen/PyInstaller/Nuitka 산출물: 기본 headless mode
  - `--legacy-ui`: frozen에서도 legacy UI
- headless one-shot smoke
  - `app.py --agent` 통과
  - `split_version/app_find.py --agent` 통과
  - `split_version/app_engage_write.py --agent` 통과
- fake AIMAX API polling smoke 재검증
  - heartbeat 2회
  - `open_settings` command 안전 failed
  - `yeri_write`, `hyunju_find` job dispatch 및 `running -> done`
  - heartbeat-only에서 command/job 큐 비소비 확인

2026-05-05 운영 heartbeat-only smoke:

- `demo@aimax.ai.kr` 계정으로 로컬 OS credential store에 웹앱 session 저장 성공
- `scripts/agent_heartbeat_only_smoke.py` 운영 API 기준 통과
  - base URL: `https://api.aimax.ai.kr`
  - `can_execute: true`
  - `connected: true`
  - status: `connected`
  - agent version: `v1.0.1`
  - platform: `Darwin 25.5.0 arm64`
  - device label: `AIXLIFEui-MacBookPro.local (Darwin)`
- smoke는 `AIMAX_AGENT_HEARTBEAT_ONLY=1` 기본값으로 실행되어 command/job 큐를 소비하지 않는다.

L1C 통과 판정:

- headless runtime이 운영 API에 실제 연결되고 heartbeat/readiness를 전송하는 것은 확인됐다.
- 다음 단계는 macOS 설치 파일 재빌드와 실제 설치 파일 기준 실행/연결 검증이다.

## 10. Phase L1D macOS 패키징 진행 기록

2026-05-05 진행:

- macOS 통합 DMG 재빌드 완료
  - 산출물: `dist/AIMAX-macos.dmg`
  - 업로드 준비 파일: `dist/upload_installers/aimax-bundle-macos.dmg`
- macOS 분리 DMG 재빌드 완료
  - 예리: `split_version/dist/AIMAX-예리씨-소통글쓰기-macos.dmg`
  - 현주: `split_version/dist/AIMAX-현주씨-영업사원-macos.dmg`
  - 업로드 준비 파일:
    - `dist/upload_installers/aimax-yeri-macos.dmg`
    - `dist/upload_installers/aimax-hyunju-macos.dmg`
- 분리 앱 버전 import 문제 수정
  - 원인: `split_version/aimax_compliance.py`가 `APP_VERSION = "v1.0.0"`으로 남아 있었고, 분리 앱 번들이 해당 파일을 먼저 import함
  - 수정:
    - `split_version/app.py`의 import path 우선순위를 root 공통 모듈 우선으로 변경
    - `split_version/aimax_compliance.py`도 `v1.0.1`로 동기화
  - 수정 전 증상: 현주 패키지 실행 시 운영 API가 `필수 업데이트 필요`로 판단
  - 수정 후 증상 소거: 예리/현주 패키지 모두 `웹앱 연결됨. 작업 대기 중입니다.`

검증 완료:

- `venv/bin/python -m py_compile app.py split_version/app.py split_version/aimax_compliance.py split_version/app_find.py split_version/app_engage_write.py scripts/agent_heartbeat_only_smoke.py scripts/save_web_agent_session.py`
- PyInstaller macOS 통합 빌드 통과
- PyInstaller macOS 예리/현주 분리 빌드 통과
- Info.plist 버전 확인
  - 통합: `CFBundleShortVersionString = 1.0.1`
  - 예리: `CFBundleShortVersionString = 1.0.1`
  - 현주: `CFBundleShortVersionString = 1.0.1`
- `codesign --verify --deep --strict`
  - 통합 app 통과
  - 예리 app 통과
  - 현주 app 통과
- `hdiutil imageinfo`
  - 통합 DMG 통과
  - 예리 DMG 통과
  - 현주 DMG 통과
- 새 패키지 실행 smoke
  - `dist/AIMAX.app/Contents/MacOS/AIMAX` heartbeat-only 운영 연결 통과
  - `split_version/dist/AIMAX-Find.app/Contents/MacOS/AIMAX-Find` heartbeat-only 운영 연결 통과
  - `split_version/dist/AIMAX-EngageWrite.app/Contents/MacOS/AIMAX-EngageWrite` heartbeat-only 운영 연결 통과

최종 macOS 업로드 준비 파일 SHA-256:

- `aimax-bundle-macos.dmg`
  - `2905a4dc4703cd73688e4b3a1ea8a7719e51e8dc8537a8f56f70b8f79b5a7a3a`
- `aimax-yeri-macos.dmg`
  - `2e2df06dab1a3b45c612ba3ff00b4d29da9d5c55d1d072498ff789b8dc1fa07d`
- `aimax-hyunju-macos.dmg`
  - `c2fe43a85c52961d7477e91d0c495cba0fd113f64248a02f85691a0a511a9054`

다음 게이트:

- 서버 `/home/ubuntu/aimax-downloads`에 macOS DMG 3종 업로드
- 웹앱 다운로드로 받은 실제 DMG 기준 설치/실행/연결 smoke
- macOS Gatekeeper 화면 캡처 확보 후 Notion 사용자 가이드 보강
- Windows `.exe` 3종은 Windows 빌드 환경에서 별도 재빌드 필요

## 11. Phase L1E macOS 다운로드 운영 반영 기록

2026-05-05 진행:

- 서버 기존 macOS DMG 3종 백업 완료
  - 백업 위치: `/home/ubuntu/aimax-downloads/archive-macos-20260505-2228-pre-l1d`
- 새 macOS DMG 3종을 서버 `/home/ubuntu/aimax-downloads`에 업로드 및 교체 완료
  - `aimax-bundle-macos.dmg`
  - `aimax-yeri-macos.dmg`
  - `aimax-hyunju-macos.dmg`
- 서버 최종 파일 SHA-256이 로컬 최종 파일과 일치함을 확인
  - bundle: `2905a4dc4703cd73688e4b3a1ea8a7719e51e8dc8537a8f56f70b8f79b5a7a3a`
  - yeri: `2e2df06dab1a3b45c612ba3ff00b4d29da9d5c55d1d072498ff789b8dc1fa07d`
  - hyunju: `c2fe43a85c52961d7477e91d0c495cba0fd113f64248a02f85691a0a511a9054`
- 운영 웹앱 다운로드 API 검증 완료
  - `/api/downloads/options`에서 macOS 3종 모두 `exists: true`
  - `/api/downloads/agent?platform=macos&product=...` 3종 모두 `200`
  - content type: `application/x-apple-diskimage`
  - content disposition filename이 서버 카탈로그와 일치
- 운영 다운로드 실제 파일 검증 완료
  - `/private/tmp/aimax-download-verify`에 웹앱 API로 3종 실제 다운로드
  - 다운로드된 파일 SHA-256이 최종 업로드 파일과 일치

실제 자동화 테스트 조건:

- 현재 demo 계정의 로컬 readiness:
  - 웹앱 로그인: ready
  - 네이버 계정/비밀번호: ready
  - Gemini Key: ready
  - Claude Key: missing
  - 선택 모델: `claude`
  - 예리 worker: missing
  - 현주 worker: 마지막 heartbeat가 예리/현주 분리 앱 중 하나에서 온 경우 앱 역할에 따라 unavailable로 보일 수 있음
- 따라서 실제 예리 글쓰기 자동화 테스트 전 선택 모델을 Gemini로 변경하거나 Claude Key를 등록해야 한다.
- 실제 자동화 테스트는 네이버 계정에 영향을 줄 수 있으므로 별도 게이트로 진행한다.
  - 추천 1차: 예리 `임시 저장(save)` 1건, 테스트 키워드 1개, 낮은 분량
  - 현주 서로이웃 신청은 실제 외부 사용자에게 요청이 갈 수 있어 최후순위

## 12. Phase L1F 웹 작업 설정 복원 및 macOS 재배포 기록

2026-05-06 진행:

- 로컬 앱에는 있었지만 웹앱 전환 중 빠져 보이던 설정 항목을 1차 복원했다.
  - 예리 작업 폼에 `AI 모델` 선택 추가
  - 설정 탭에 `웹 작업 설정` 추가
  - 기본 모델을 `gemini-2.5-pro`로 조정
  - 블로그 프로필 기반 댓글/서로이웃 멘트 초안 생성 추가
  - 현주 작업 폼에 웹 설정 멘트 자동 적용
- 서버에 저장하면 안 되는 민감정보 경계는 유지했다.
  - 네이버 PW/API Key는 여전히 웹앱/서버 저장 대상이 아니다.
  - 웹 작업 설정은 브라우저 localStorage에 저장한다.
  - 현주 작업 실행 시 필요한 멘트는 job payload로만 전달된다.
- Local Agent가 웹 job payload의 `ai_model`을 받아 글쓰기 worker에 넘기도록 수정했다.
  - `app.py`
  - `split_version/app.py`
- keychain prompt 반복을 줄이기 위한 변경도 포함되어 있다.
  - 새 keyring service 기본값: `AIMAX`
  - legacy `NaverBlogAuto`는 1회 폴백/마이그레이션 경로로만 사용
  - `AIMAX_DISABLE_LEGACY_KEYCHAIN`, `AIMAX_DISABLE_KEYCHAIN`, env secret override 지원

검증 완료:

- `./venv/bin/python -m py_compile app.py split_version/app.py`
- `node --check oracle/aimax-reports-api/server.js`
- `app.html` inline script `new Function(...)` 문법 확인
- 로컬 API smoke
  - `/health` 정상
  - 예리 job payload에 `ai_model: gemini-2.5-pro` 포함 확인
  - 현주 job payload에 웹 멘트 포함 확인
- Playwright headless UI smoke
  - 설정 탭 기본 모델: `gemini-2.5-pro`
  - 예리 작업 폼 모델: `gemini-2.5-pro`
  - 멘트 초안 10개 생성
  - 현주 작업 입력에 10개 복사
- headless Agent polling smoke
  - heartbeat 전송
  - headless `open_settings` 안전 failed
  - 예리/현주 fake job done
  - 강제 예리 실패 job이 서버에 `failed`로 보고됨
  - 웹 payload의 `ai_model`이 worker kwargs에 전달됨
- macOS 통합/예리/현주 재빌드 완료
  - codesign verify 3종 통과
  - hdiutil imageinfo 3종 통과

최종 macOS 업로드 파일 SHA-256:

- `aimax-bundle-macos.dmg`
  - `b725f1d18372282c854186e55957a8ebf72edabc06460b8aec423aabe86abbd7`
- `aimax-yeri-macos.dmg`
  - `2fa9af12e1a217fda91ebbbdaf909d70aef88d023e6bf9e1a1f6369e83340cf5`
- `aimax-hyunju-macos.dmg`
  - `2254c00e1f81bbc2e72134960061954b384b643f229b9dee6bd84060ebf79b37`

운영 반영:

- 운영 백업 위치:
  - `/home/ubuntu/aimax-downloads/archive-macos-20260506-003951-web-settings`
- 운영 서버 업로드 완료:
  - `/home/ubuntu/aimax-reports-api/static/app.html`
  - `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`
  - `/home/ubuntu/aimax-downloads/aimax-yeri-macos.dmg`
  - `/home/ubuntu/aimax-downloads/aimax-hyunju-macos.dmg`
- 운영 서버 SHA-256이 로컬 최종 SHA-256과 일치함을 확인
- 운영 `https://api.aimax.ai.kr/health` 정상
- 운영 `https://api.aimax.ai.kr/app`에서 새 웹 작업 설정 UI와 `gemini-2.5-pro` 기본값 서빙 확인

남은 실제 자동화 테스트 기준:

- `gemini-2.5-pro`는 로컬 설정과 웹 기본값이 맞춰졌다.
- 단, 이전 실제 호출에서 Gemini Pro quota/RESOURCE_EXHAUSTED 가능성이 확인되었으므로 실제 예리 글쓰기 테스트는 `임시 저장(save)`, 키워드 1개, 낮은 분량으로 실행한다.
- Keychain prompt가 다시 보이면 병렬 실행기를 여러 개 띄우지 말고 하나만 실행한 상태에서 진행한다.

## 13. Phase L1G 키워드 과반복 완화 및 모델 기본값 정리

2026-05-06 진행:

- 사용자가 요청한 "본문 작성 중 동일 키워드가 반복 작성되는 문제"를 1차 수정했다.
  - 공통 프롬프트에 정확한 키워드 문구 반복 제한, 문단 시작 반복 금지, `키워드: ...` 본문 삽입 금지 규칙 추가
  - 정보성/구매성 글 프롬프트의 반복 허용 범위를 `4~6회 이하`로 축소
  - 글 생성 후 정확한 키워드 반복 횟수와 문단 시작 반복을 감지하는 후처리 검사 추가
  - 반복이 과하면 같은 모델에 재작성 요청을 한 번 보내 키워드 반복만 완화
- Gemini 기본값 정리를 추가했다.
  - 글쓰기 기본 모델: `gemini-2.5-pro`
  - 서로이웃/댓글 멘트 생성 기본 모델: `gemini-2.5-pro`
  - 기존 저장값 `gemini-3.1-pro-preview`는 `gemini-2.5-pro`로 자동 정규화
  - 웹앱 모델 선택 목록에서 `Gemini 3.1 Pro Preview` 제거

검증 완료:

- `./venv/bin/python -m py_compile app.py split_version/app.py content/ai_text.py content/prompts.py content/neighbor_message_ai.py`
- `node --check oracle/aimax-reports-api/server.js`
- `app.html` inline script `new Function(...)` 문법 확인
- legacy model normalization 확인
  - `gemini-3.1-pro-preview` -> `gemini-2.5-pro`
- 키워드 반복 감지 단위 확인
  - 테스트 문장 exact count 6회, 문단 시작 4회, 한도 4회에서 rewrite 필요 판정
- headless Agent polling smoke
  - heartbeat 전송
  - 예리 fake job done
  - 현주 fake job done
  - 강제 예리 실패 job이 `failed`로 보고됨
  - 예리 worker kwargs의 `ai_model`이 `gemini-2.5-pro`로 전달됨
- macOS 통합/예리/현주 재빌드 완료
  - codesign verify 3종 통과
  - hdiutil imageinfo 3종 통과

최종 macOS 업로드 파일 SHA-256:

- `aimax-bundle-macos.dmg`
  - `c9465d7e9871ad2316882520a2409035b102a7e921f1dda496e8214da6603112`
- `aimax-yeri-macos.dmg`
  - `07dcba3bad3b3a2c0393d09aa2c2689178d3a62a74361f6221ad8b98df4484ff`
- `aimax-hyunju-macos.dmg`
  - `45c40266d61a9c07f0f2ae78dd9572a43f01880d44fecbd2f364c516dc792234`

운영 반영:

- 운영 백업 위치:
  - `/home/ubuntu/aimax-downloads/archive-macos-20260506-005741-keyword-model-fix`
  - `/home/ubuntu/aimax-reports-api/static/app.html.20260506-005741-keyword-model-fix.bak`
- 운영 서버 업로드 완료:
  - `/home/ubuntu/aimax-reports-api/static/app.html`
  - `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`
  - `/home/ubuntu/aimax-downloads/aimax-yeri-macos.dmg`
  - `/home/ubuntu/aimax-downloads/aimax-hyunju-macos.dmg`
- 운영 서버 SHA-256이 로컬 최종 SHA-256과 일치함을 확인
- 운영 `https://api.aimax.ai.kr/health` 정상

## 14. Phase L1H 원화 비용 표시, 이미지 개수 옵션, SEO 이미지 분석 준비

2026-05-06 진행:

- 웹검색으로 공식 단가와 환율을 다시 확인한 뒤, 예리 글쓰기 폼에 사용자가 이해할 수 있는 원화 예상 비용 표시를 추가했다.
  - 환율 기준: Wise 미드마켓 `1 USD = 1,470 KRW`
  - Gemini 2.5 Pro 글 생성 기준: 입력 `$1.25 / 1M tokens`, 출력 `$10.00 / 1M tokens`
  - Gemini 2.5 Flash 기준: 입력 `$0.30 / 1M tokens`, 출력 `$2.50 / 1M tokens`
  - Claude Sonnet 기준: 입력 `$3 / MTok`, 출력 `$15 / MTok`
  - GPT 비용 참고 기준: OpenAI GPT-5.4 mini 입력 `$0.75 / 1M tokens`, 출력 `$4.50 / 1M tokens`
  - Gemini 2.5 Flash Image 기준: `$0.039 / image`
- 웹앱 예리 작업 폼에 이미지 생성 개수 옵션을 추가했다.
  - 선택 범위: `0장`부터 `6장`
  - 기본값: `3장`
  - 예상 비용은 `글 생성 비용 + 이미지 개수 * 이미지 단가`로 원화 표시
  - 화면 표시 예: `예상 원가 약 216원`, `글 44원 + 이미지 3장 172원`
- Local Agent job payload에 `image_count`를 연결했다.
  - 웹앱에서 보낸 이미지 개수가 `app.py`, `split_version/app.py`의 글쓰기 worker까지 전달된다.
  - `content/ai_text.py`는 요청 이미지 개수만큼 `[이미지]` 프롬프트 줄을 만들도록 조정했다.
  - markdown 파싱 후에도 이미지 블록이 요청 개수를 넘으면 초과 이미지를 제거한다.
- OpenAI 이미지 생성 가능성도 확인했다.
  - OpenAI Images API/Responses API에서 이미지 생성·편집이 가능하다.
  - 현재 앱에는 OpenAI API key 저장/실행 경로가 아직 없으므로 이번 배포에서는 GPT 비용 참고값만 표시했다.
  - 실제 GPT 실행 모델 및 이미지 생성까지 열려면 다음 구현에서 OpenAI key 저장, SDK 의존성, 모델 선택, 비용 측정 결과 저장을 별도 게이트로 추가한다.

검증 완료:

- `./venv/bin/python -m py_compile app.py split_version/app.py content/ai_text.py content/prompts.py content/neighbor_message_ai.py`
- `node --check oracle/aimax-reports-api/server.js`
- `app.html` inline script `new Function(...)` 문법 확인
- 이미지 개수 helper 확인
  - `0~8` 범위로 정규화
  - 초과 이미지 블록 제거
- Playwright headless DOM smoke
  - 예리 이미지 옵션 `0장~6장` 표시
  - 원화 예상 비용 표시
  - `Gemini 2.5 Pro + 1,500자 + 이미지 3장` 기준 `약 216원` 표시
- headless Agent polling smoke
  - 예리 fake job payload의 `image_count: 4`가 worker kwargs에 전달됨
  - 기본값 없는 실패 job은 `image_count: 3`으로 정규화됨
- macOS 통합/예리/현주 재빌드 완료
  - codesign verify 3종 통과
  - hdiutil imageinfo 3종 통과

최종 macOS 업로드 파일 SHA-256:

- `aimax-bundle-macos.dmg`
  - `2728a57a8014c28db40e9a839a112feeb796959bedd539fb6ecaf53fbb239621`
- `aimax-yeri-macos.dmg`
  - `701057e2e462c666b16108303d144dbd656a886f09a94c26d722d626d7482f71`
- `aimax-hyunju-macos.dmg`
  - `09fc98eb9c5f88155ceac5a3752d1439f40770f46bcae4b3c4bb3debb5e76d90`

운영 반영:

- 운영 백업 위치:
  - `/home/ubuntu/aimax-downloads/archive-macos-20260506-021007-krw-image-count`
  - `/home/ubuntu/aimax-reports-api/static/app.html.20260506-021007-krw-image-count.bak`
- 운영 서버 업로드 완료:
  - `/home/ubuntu/aimax-reports-api/static/app.html`
  - `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`
  - `/home/ubuntu/aimax-downloads/aimax-yeri-macos.dmg`
  - `/home/ubuntu/aimax-downloads/aimax-hyunju-macos.dmg`
- 운영 서버 SHA-256이 로컬 최종 SHA-256과 일치함을 확인
- 운영 `https://api.aimax.ai.kr/health` 정상
- 인증 세션 기준 `/api/downloads/options`에서 macOS/Windows 6종 모두 `exists: true`
- 인증 세션 기준 `/api/downloads/agent?platform=macos&product=bundle|yeri|hyunju` 3종 모두 `200`, `application/x-apple-diskimage`, 첫 1KB 수신 확인

다음 SEO/상위노출 분석 Phase 기준:

- 사용자가 입력한 키워드로 상위 노출 글을 분석할 때 텍스트만 보지 않는다.
- 수집 후보:
  - 제목 구조와 키워드 위치
  - 본문 길이, 소제목 수, 문단 밀도
  - 키워드 반복 횟수와 변형어/연관어 분포
  - 이미지 개수
  - 첫 이미지 위치
  - 이미지 유형: 실제 사진, 제품 사진, 과정 사진, 전후 비교, 캡처, 인포그래픽, 표/체크리스트
  - 이미지 주변 문맥: 캡션성 문장, 장소/제품/경험 근거 문장
  - 동영상/지도/링크/표 등 보조 콘텐츠 여부
- 원칙:
  - 상위 글의 이미지를 복사하거나 유사하게 재현하지 않는다.
  - 상위 글의 이미지 구성 패턴만 분석해 "이 키워드에서는 몇 장, 어떤 역할의 이미지가 필요한지"를 글 작성 전 브리프로 만든다.
  - 네이버 검색어 노출 자체를 보장하는 표현은 쓰지 않고, 검색 친화성과 독자 체류에 유리한 구조를 제안한다.

참고 출처:

- OpenAI API Pricing: `https://openai.com/api/pricing/`
- OpenAI Images and vision: `https://developers.openai.com/api/docs/guides/images-vision`
- Gemini Developer API pricing: `https://ai.google.dev/gemini-api/docs/pricing`
- Anthropic/Claude pricing: `https://claude.com/pricing`
- Wise USD/KRW: `https://wise.com/kr/currency-converter/usd-to-krw-rate?amount=1`

## 15. Phase L1I 실제 비용 기록과 SEO 브리프 안전 연결

목적:

- 예상 비용만 보여주는 상태에서 한 단계 더 나아가, 실제 AI 응답 usage token을 job 결과에 저장한다.
- 사용자 화면에는 항상 원화 기준 비용만 표시한다.
- 상위노출 분석은 실제 네이버 글쓰기 자동화에 바로 섞지 않고, 먼저 분석 브리프 구조와 프롬프트 연결까지만 안전하게 붙인다.

L1I-1 실제 usage token과 원화 비용 저장:

- `content/ai_text.py`
  - Gemini/Claude 글 생성 usage를 이미 반환하던 구조를 유지하면서 Gemini thinking token을 `thinking_tokens`, `billable_output_tokens`로 분리했다.
- `posting/editor.py`
  - 본문 입력 후 이미지 `attempted/generated/inserted` 개수를 반환하도록 변경했다.
  - 비용 계산은 실제 생성된 이미지 수 기준으로 원화 환산한다.
- `app.py`, `split_version/app.py`
  - `_worker_write()`가 `return_usage=True`로 글 생성 결과를 받고 usage를 누적한다.
  - 결과 dict에 `usage`, `images`, `cost`를 포함한다.
  - 비용은 `KRW`, `total_won`, `text_won`, `image_won` 형태로 저장한다.
  - USD 금액 필드는 job result/API 응답에 저장하지 않는다.
  - 환율 기준은 Phase L1H와 동일하게 `1 USD = 1,470 KRW`다.
- `web_agent/client.py`
  - `/api/agent/jobs/update` 호출 시 선택적으로 `result` payload를 보낼 수 있게 했다.
- `oracle/aimax-reports-api/server.js`
  - job update의 `result`를 숫자 중심으로 sanitize해서 저장한다.
  - `/api/jobs` 응답에 `result`를 포함한다.
- `oracle/aimax-reports-api/static/app.html`
  - 작업 목록에 `실제 비용` 열을 추가했다.
  - 완료된 예리 작업은 `총 원화 비용`, `글 비용`, `이미지 비용`, `입력/출력 token`, `이미지 생성 장수`를 표시한다.

L1I-2 SEO/이미지 분석 브리프 구조:

- `content/seo_brief.py` 추가
  - 이미 수집된 상위 글 snapshot을 입력받아 분석 브리프를 만든다.
  - 분석 항목:
    - 제목 키워드 포함 여부
    - 본문 단어 수
    - 소제목 수
    - 키워드 반복 횟수
    - 이미지 개수
    - 첫 이미지가 초반에 배치됐는지 여부
    - 이미지 역할: product/process/screenshot/comparison/infographic/place/real_photo
  - 추천 이미지 수는 상위 글 이미지 수의 median을 기준으로 `1~6장` 범위에서 제안한다.
- `content/ai_text.py`
  - `seo_brief`가 전달되면 상위 글 분석 브리프를 프롬프트에 추가한다.
  - 상위 글의 문장, 제목, 이미지 소재를 복사하지 말고 구조적 패턴만 참고하도록 명시했다.
- `app.py`, `split_version/app.py`
  - 웹 job payload에 `seo_brief`가 있으면 글쓰기 worker까지 전달할 수 있게 했다.

검증 완료:

- `./venv/bin/python -m py_compile app.py split_version/app.py content/ai_text.py content/seo_brief.py posting/editor.py web_agent/client.py scripts/headless_agent_polling_smoke.py`
- `node --check oracle/aimax-reports-api/server.js`
- `app.html` inline script `new Function(...)` 문법 확인
- 비용 계산 helper 확인
  - `Gemini 2.5 Pro`, 입력 2,200 tokens, 출력 3,100 billable tokens, 이미지 3장 기준
  - `currency: KRW`
  - `image_won: 172`
  - `total_won: 222`
- 로컬 API 서버 실제 HTTP 검증
  - `/api/agent/jobs/update`에 `result.cost.currency: KRW`, `total_won: 152` 전송
  - `/api/jobs`에서 같은 원화 비용이 저장/반환됨 확인
  - `total_usd` 같은 USD 금액 필드는 sanitize 후 응답에서 제거됨 확인
- `scripts/headless_agent_polling_smoke.py`
  - 예리 성공 job update에 `result.cost.currency: KRW` 포함
  - 예리 실패 job update에도 `result.cost.currency: KRW` 포함
  - 기존 예리/현주 job dispatch 흐름 유지
  - heartbeat-only 모드는 queued work를 소비하지 않음

남은 L1I-3 게이트:

- 실제 네이버 계정에 예리 글쓰기 `임시 저장(save)` 1건을 만든다.
- 권장 테스트 조건:
  - 키워드 1개
  - 이미지 1장 또는 2장
  - 낮은 글 분량
  - `publish` 금지, 반드시 `save`
  - 완료 후 웹앱 작업 목록에 실제 원화 비용이 표시되는지 확인
- 이 단계는 사용자 네이버 계정에 실제 임시저장 글이 생기므로, 시작 전 키워드와 이미지 장수를 확정하고 진행한다.

운영 API 선반영:

- 실제 비용 저장 확인을 위해 운영 API 서버와 웹앱 HTML을 먼저 교체했다.
- 운영 백업:
  - `/home/ubuntu/aimax-reports-api/server.js.20260506-031341-l1i-cost-result.bak`
  - `/home/ubuntu/aimax-reports-api/static/app.html.20260506-031341-l1i-cost-result.bak`
- 운영 반영:
  - `/home/ubuntu/aimax-reports-api/server.js`
  - `/home/ubuntu/aimax-reports-api/static/app.html`
  - `systemctl --user restart aimax-reports-api`
  - `https://api.aimax.ai.kr/health` 정상

L1I-3 실제 테스트 결과:

- 테스트 키워드: `바이브코딩`
- 1차 시도:
  - 모델: `gemini-2.5-pro`
  - 모드: `save`
  - 결과: 실패
  - 원인: Gemini Pro quota `RESOURCE_EXHAUSTED`, free tier limit `0`
  - job id: `31c44d1e-bb87-402e-b726-b1542f13d11a`
  - 비용 기록: `currency: KRW`, `total_won: 0`
- 2차 시도:
  - 모델: `gemini-2.5-flash`
  - 모드: `save`
  - 이미지 요청: `1장`
  - 결과: 성공, 네이버 임시저장 완료
  - job id: `1e893a76-2fdd-448d-9734-b584fcf0c1b4`
  - 제목: `바이브코딩, 코딩 학습의 새로운 기준을 제시하는 3가지 이유`
  - 사용량:
    - input tokens: `1,383`
    - output tokens: `1,049`
    - thinking tokens: `1,297`
    - billable output tokens: `2,346`
    - total tokens: `3,729`
  - 실제 원화 비용:
    - 글 비용: `10원`
    - 이미지 비용: `0원`
    - 총 비용: `10원`
  - 이미지 결과:
    - attempted: `1`
    - generated: `0`
    - inserted: `0`
    - 원인: Gemini image model quota `RESOURCE_EXHAUSTED`, free tier limit `0`
- 운영 `/api/jobs` 재조회에서 성공/실패 job 모두 result와 원화 비용이 저장/반환됨을 확인했다.

판단:

- Local Agent의 네이버 로그인, 글쓰기 에디터 진입, 제목/본문 입력, 임시저장 자동화는 통과했다.
- 실제 usage token과 원화 비용 저장/표시 구조도 통과했다.
- 남은 막힘은 코드 문제가 아니라 Gemini Pro/Image API quota 문제다.
- 이미지가 필수인 운영 품질을 위해서는 Gemini 유료 billing 또는 OpenAI Images 실행 경로 추가가 다음 우선순위다.

## 16. Phase L1J GPT/OpenAI 모델, 로컬 보안 설정, 글자수 보정 기록

2026-05-06 진행:

- GPT 모델 선택지를 추가했다.
  - `gpt-5.4-mini`
  - `gpt-5-mini`
- OpenAI 글 생성 경로를 `content/ai_text.py`에 추가했다.
  - OpenAI Responses API 사용
  - usage token을 수집해 기존 원화 비용 계산에 합산
  - reasoning effort는 `minimal`로 낮춰 글쓰기 비용과 속도를 줄임
- OpenAI 이미지 생성 경로를 추가했다.
  - `content/openai_image.py`
  - GPT 모델 선택 시 OpenAI 이미지 생성을 우선 사용
  - Gemini 이미지 생성 실패 시 OpenAI fallback도 가능
- 비용 기준을 모두 원화 표시로 유지했다.
  - 환율: `1 USD = 1,476 KRW`
  - 기준일: `2026-05-06`
  - Gemini 이미지: `$0.039`
  - OpenAI 이미지: `$0.042`
  - job result에는 USD 금액을 저장하지 않고 `KRW`, `text_won`, `image_won`, `total_won`만 저장
- 웹앱 설정/작업 UI에 GPT 모델과 OpenAI 이미지 비용 추정을 반영했다.
- 운영 API 서버 result sanitize에 OpenAI image provider counts와 글자수 결과 필드를 추가했다.

사용자 입력 API Key 경로 보정:

- 개발자 금고/개인 Keychain fallback 흔적을 제품 코드에서 제거했다.
- 실제 제품 경로는 아래 기준으로 고정한다.
  - 사용자가 로컬 보안 설정 화면에서 직접 네이버 비밀번호/API Key 입력
  - 사용자 PC의 OS 안전 저장소에 저장
  - Local Agent가 그 사용자 PC의 저장값으로 실행
  - 서버와 웹앱에는 API Key 원문을 저장하지 않음
- headless Local Agent의 `open_settings` 명령은 더 이상 실패하지 않는다.
  - 기존 전체 Tkinter UI 대신 작은 `AIMAX 로컬 보안 설정` 창을 연다.
  - 저장 시 `naver_pw`, `gemini_api_key`, `claude_api_key`, `openai_api_key`를 이 PC 안전 저장소에 저장한다.

글자수 정확도 개선:

- 기존 프롬프트/UI가 `단어` 기준처럼 동작해 800 요청이 2,000자 가까이 길어질 수 있었다.
- 글쓰기 분량 기준을 `최종 노출 글자 수`로 고정했다.
  - 제목 + 본문 기준
  - 공백 포함
  - 마크다운 기호와 `[이미지]` 프롬프트 줄은 제외
- `content/ai_text.py`의 공통 생성 함수에서 모델과 관계없이 글자수를 검사한다.
  - Gemini 2.5 Pro
  - Gemini 2.5 Flash
  - Claude
  - GPT-5.4 mini
  - GPT-5 mini
- 허용 범위는 목표 글자수의 `±5%`다.
  - 예: 800자 요청 시 760~840자
- 범위를 벗어나면 최대 2회 재작성한다.
- job result의 posts에 `char_count`, `target_char_count`를 저장하고 웹앱 작업 목록에 표시한다.

검증 완료:

- 문법/정적 확인
  - `./venv/bin/python -m py_compile content/prompts.py content/ai_text.py content/neighbor_message_ai.py engagement/auto_comment.py app.py split_version/app.py local_agent/runtime.py scripts/headless_agent_polling_smoke.py`
  - `node --check oracle/aimax-reports-api/server.js`
  - `app.html` inline script `new Function(...)` 문법 확인
- 사용자 입력 키 저장 경로 단위 테스트
  - `save_settings(..., openai_key="openai-user-input")`가 `openai_api_key` 저장 슬롯을 사용함 확인
  - 로딩 시 사용자 입력값이 그대로 복원됨 확인
- 글자수 공통 적용 mock 테스트
  - Gemini 2.5 Pro, Gemini 2.5 Flash, Claude, GPT-5 mini, GPT-5.4 mini 모두 800자 요청에서 760~840자 범위 재작성 루프 통과
- OpenAI 실호출 테스트
  - 키워드: `바이브코딩`
  - 모델: `gpt-5-mini`
  - 요청: 800자, 이미지 0장
  - 1차 초안이 범위를 벗어나 재작성됨
  - 최종: `777자`
  - 비용: `4원`
  - thinking tokens: `0` 확인
- headless Agent smoke
  - heartbeat 전송
  - `open_settings` command가 `done`으로 보고됨
  - 예리/현주 fake job dispatch 유지
  - 예리 job result에 `KRW` 비용과 `char_count/target_char_count` 포함 확인
  - heartbeat-only 모드는 queued work를 소비하지 않음
- macOS 빌드/검증
  - 통합/예리/현주 DMG 3종 재빌드
  - `codesign --verify --deep --strict` 3종 통과
  - `hdiutil imageinfo` 3종 통과
  - frozen 앱 3종 기본 headless 진입 확인

운영 반영:

- 웹앱 운영 파일 백업:
  - `/home/ubuntu/aimax-reports-api/server.js.20260506-044928-gpt-char-count.bak`
  - `/home/ubuntu/aimax-reports-api/static/app.html.20260506-044928-gpt-char-count.bak`
- 운영 웹앱 재시작:
  - `systemctl --user restart aimax-reports-api`
  - `/health` 정상
  - HTTPS 응답에서 `gpt-5-mini`, `GPT-5.4 mini`, `800자`, `글자 수`, `OPENAI_IMAGE_PRICE_USD` 포함 확인
- macOS 운영 다운로드 파일 백업:
  - `/home/ubuntu/aimax-downloads/archive-macos-20260506-044544-pre-char-count-final`
- macOS 운영 다운로드 3종 교체 완료
  - `aimax-bundle-macos.dmg`
  - `aimax-yeri-macos.dmg`
  - `aimax-hyunju-macos.dmg`
- 서버 최종 SHA-256:
  - bundle: `3a69f9778fbfb2d2e569b5dad0eac22dd6db9dc66f23a9c88eeb69fd08071c55`
  - yeri: `7acbc85ac0fbf14a6a9abc7a9bddf0d20a4af7f5a8a843a049691b40710c09a5`
  - hyunju: `11b796fd7f7542a26773af7c31d20f330cec2405971945484c239636dda48e26`

남은 게이트:

- Windows EXE 3종은 macOS에서 재빌드할 수 없으므로, 같은 변경을 포함해 Windows 환경에서 재빌드/업로드해야 한다.
- 실제 네이버 자동화 테스트는 이전 Gemini Flash 임시저장으로 통과했지만, GPT + OpenAI 이미지 조합의 네이버 임시저장 1건은 아직 수행하지 않았다.
- 다음 권장 테스트:
  - 키워드: `바이브코딩`
  - 모델: `gpt-5-mini`
  - 글자수: `800자`
  - 이미지: `1장`
  - 모드: `save`
  - 확인: 네이버 임시저장, 웹앱 job result의 `char_count`, `target_char_count`, `KRW 비용`, OpenAI image provider count

## 17. Phase L1K Windows 인수인계 문서화 기록

2026-05-06 진행:

- Windows 사용자가 훨씬 많기 때문에 L1J 이후 최우선 게이트를 Windows 재빌드/검증으로 정리했다.
- 기존 `docs/windows_build_v1_0_1_handoff.md`는 “최초 v1.0.1 빌드” 성격이 강했으므로, 최신 L1J 변경 반영 재빌드 지시서로 전면 갱신했다.
- `docs/windows_ai_build_prompt.md`도 Windows 데스크탑 AI 개발자에게 그대로 전달할 수 있는 짧은 실행 프롬프트로 갱신했다.
- `docs/local_agent_transition_handoff.md`에는 2026-05-06 기준 phase 위치, 완료된 변경, 남은 Windows 게이트를 별도 section으로 추가했다.

Windows 문서에 반영한 핵심 내용:

- 서버에 기존 Windows v1.0.1 EXE가 있어도 L1J 이전 파일이면 stale로 취급
- macOS 최신 프로젝트를 source of truth로 삼아 Windows 폴더를 먼저 동기화
- 2026-05-06 전달용 `handoff/aimax-l1j-windows-transfer-20260506.zip` 생성
- transfer zip에는 최신 source zip과 encrypted test secrets만 포함하고, passphrase는 제외
- encrypted test secrets에는 OpenAI/Gemini/Anthropic API key를 넣고 네이버 비밀번호는 제외
- GPT 모델 선택지와 OpenAI 글/이미지 생성 경로
- 사용자 입력 OpenAI key 저장 경로와 개발자 개인 key fallback 제거 조건
- headless frozen 앱 기본 실행과 작은 `AIMAX 로컬 보안 설정` 창
- 글자수 ±5% 보정과 `char_count/target_char_count` result 저장
- 원화 비용 저장/표시, 이미지 provider count
- Windows 정적 검증, fake headless smoke, 운영 heartbeat-only smoke
- PyInstaller hidden import/xref 확인 항목
- Inno Setup 설치파일 3종 생성 명령
- 운영 업로드 전 기존 Windows EXE archive 백업
- 업로드 후 SHA-256 일치 확인
- 가능하면 GPT `gpt-5-mini` + OpenAI 이미지 1장 + `바이브코딩` 800자 + `save` 실전 테스트

현재 phase 판정:

- L1J macOS 구현/운영 반영은 완료
- L1K 문서화는 완료
- 다음 실행 phase는 L8 Windows 반영이다.

다음 Windows 게이트 완료 기준:

- Windows EXE 3종이 최신 L1J 코드로 재빌드됨
- 설치 후 기존 전체 Tkinter UI가 뜨지 않음
- 저장된 session token이 없는 첫 실행에서 작은 `AIMAX 웹앱 연결` 창이 뜸
- 웹앱 로그인 성공 후 session token이 Windows 안전 저장소에 저장됨
- 웹앱 “로컬 설정 열기”가 Windows에서 작은 보안 설정 창을 엶
- Windows heartbeat/readiness가 운영 웹앱에 표시됨
- Windows fake smoke 또는 운영 heartbeat-only smoke 통과
- 업로드 전 기존 운영 Windows EXE 백업 완료
- 운영 다운로드 폴더에 새 EXE 3종 업로드
- 로컬 SHA-256과 서버 SHA-256 일치
- 웹앱 Windows 다운로드 버튼 활성화 확인

## 18. Phase L1L 첫 실행 웹앱 연결 UX 기준

2026-05-06 추가 판단:

- 설치파일 다운로드는 자동 연결이 아니다.
- 개발 smoke에서 사용한 `scripts/save_web_agent_session.py`는 일반 사용자가 실행하지 않는다.
- 따라서 새 PC/첫 사용자에게는 session token을 로컬 안전 저장소에 저장하는 첫 실행 UX가 필요하다.

MVP 결정:

- 저장된 session token이 없으면 headless Agent가 작은 `AIMAX 웹앱 연결` 창을 띄운다.
- 사용자는 AIMAX 웹앱 이메일/비밀번호로 로그인한다.
- Local Agent는 `/api/auth/login` 응답의 session token만 OS credential store에 저장한다.
- 이어서 작은 `AIMAX 로컬 보안 설정` 창을 열어 네이버 ID/PW와 AI API key를 로컬 안전 저장소에 저장한다.
- 이후 heartbeat/job polling을 시작한다.

중요한 운영 판단:

- Windows AI가 이 연결 UX를 구현하는 것은 방향이 맞다.
- 다만 Windows 전용 patch로 끝내면 macOS와 다시 갈라진다.
- 구현은 가능하면 `local_agent/runtime.py` 공통 코드에 두고, macOS source에도 같은 patch를 반영해야 한다.
- 서버 웹앱 파일을 수정했다면 Windows 빌드와 별개로 운영 서버 배포/검증이 필요하다.

다음 개선 phase:

- 더 매끄러운 UX는 localhost pairing bridge다.
- 웹앱에서 short-lived pairing token을 만들고, `127.0.0.1` Local Agent endpoint로 전달하는 방식이다.
- 이 방식은 서버/웹앱/Agent 계약이 모두 바뀌므로 별도 phase로 분리한다.
