# AIMAX Local Agent 전용화 Handoff

작성일: 2026-05-05

새 Codex 세션을 시작하면 이 문서를 먼저 읽고 이어서 진행한다. 이 문서는 AIMAX를 “기존 설치형 프로그램 + 보조 웹앱”이 아니라 “웹앱 본체 + 화면 없는 Local Agent” 구조로 바로잡기 위한 전체 맥락과 실행 phase다.

## 새 세션 시작 프롬프트

다음 세션에서 바로 이어갈 때는 이렇게 시작하면 된다.

```text
/Users/aixlife/Projects/AIMAX-AI-Staff-Management/docs/local_agent_transition_handoff.md 를 먼저 읽고, AIMAX Local Agent 전용화 Phase 0부터 이어서 진행해줘. 기존 웹앱 UI phase를 계속 미는 게 아니라, 설치 파일이 기존 Tkinter 전체 UI를 띄우는 문제를 해결하는 게 우선이야.
```

## 현재 문제

현재 AIMAX 웹앱은 운영 콘솔처럼 많이 정리되었고, 서버/작업 큐/오류 보고/다운로드도 붙어 있다. 하지만 사용자가 설치 파일을 내려받아 실행하면 기존 Python/Tkinter 전체 프로그램 UI가 그대로 보인다.

그 결과:

- 사용자는 “웹앱에서 쓸 필요 없이 프로그램에서 다 하면 되는데?”라고 느낀다.
- 설치 파일이 “Local Agent 설치기”가 아니라 “기존 프로그램 다운로드”처럼 보인다.
- 웹앱이 제품 본체가 아니라 기존 프로그램의 보조 대시보드처럼 보인다.
- 원래 목표였던 “웹앱 로그인 후 모든 운영을 웹앱에서 처리”하는 경험이 완성되지 않았다.

이 문제를 해결하지 않은 상태에서 웹앱 UI만 계속 개선하면 방향이 틀어진다.

## 확정된 제품 방향

AIMAX의 새 제품 경계는 아래처럼 고정한다.

```text
웹앱 = 사용자가 보는 본체, control plane
서버 = 계정/권한/기기/작업 큐/상태/오류/업데이트 관리
Local Agent = 화면 없는 백그라운드 실행기, data plane
사용자 PC = 네이버 로그인, 쿠키, AI API Key, Chrome/Selenium 실행 위치
```

사용자 관점의 목표 흐름:

1. 사용자가 웹앱에 로그인한다.
2. 웹앱에서 본인 OS에 맞는 AIMAX 실행기 설치 파일을 받는다.
3. 설치 파일을 더블클릭해 설치한다.
4. 설치가 끝나면 기존 프로그램 화면은 뜨지 않는다.
5. Local Agent가 백그라운드에서 자동 실행되고 웹앱에 연결된다.
6. 다음부터 사용자는 웹앱에 로그인만 하면 자동 연결 상태를 본다.
7. 작업 지시, 설정, 오류 보고, 업데이트 확인은 모두 웹앱에서 한다.
8. Local Agent는 웹앱 작업을 받아 기존 예리/현주 자동화 로직을 실행한다.

## 절대 지켜야 할 보안 경계

서버에 저장하면 안 되는 것:

- 네이버 비밀번호
- 네이버 쿠키/세션
- Gemini API Key
- Claude API Key
- 긴 인증 토큰 원문
- Chrome profile 내부 민감 데이터

서버에 저장해도 되는 것:

- 사용자 이메일
- 상품 권한: `yeri`, `hyunju`, `bundle`
- 기기 ID, 기기 표시명, 등록 상태
- Local Agent 버전/플랫폼/마지막 연결 시간
- readiness 상태: 설정됨/없음/확인 필요
- 작업 큐와 redacted payload
- 오류 보고 요약과 redacted 로그

로컬에만 저장해야 하는 것:

- 네이버 ID/PW
- API Key
- 서로이웃 멘트 원문
- 쿠키/세션
- Chrome/Selenium 실행 상태

로컬 저장 기준:

- macOS: Keychain 사용
- Windows: DPAPI 또는 Windows Credential Manager 사용
- 평문 JSON 저장 금지
- 로그/오류 보고 전송 시 마스킹 필수

## AI 의견 요약

외부 AI Council은 시도했으나 Claude CLI는 타임아웃, Gemini CLI는 비대화 인증 문제로 실패했다. 대신 현재 사용 가능한 전문 에이전트 3개 관점으로 독립 의견을 받았다.

공통 결론:

- 웹은 control plane, Local Agent는 data plane으로 명확히 분리해야 한다.
- 사용자 세션과 기기/Agent 세션을 분리해야 한다.
- Local Agent 최초 설치 시 기기 키 또는 install ID를 만들고 서버에는 기기 상태만 등록한다.
- 웹 설정 UX는 제공하되, 민감정보는 서버가 아니라 로컬 Agent로 직접 또는 암호화된 브리지로 전달해야 한다.
- 기존 Tkinter 앱은 UI, 설정, 실행 로직이 한 몸이라 UI 제거와 worker 안정성 보존을 동시에 건드리면 위험하다.
- macOS에서 작은 phase로 검증한 뒤 Windows에 반영해야 한다.

중요한 경고:

- 지금처럼 기존 Tkinter 전체 UI가 일반 사용자 설치파일에서 열리면 웹앱 전환은 실패한 경험이 된다.
- “웹앱에서 입력받아 서버에 저장 후 Agent가 받는 방식”은 네이버 PW/API Key 때문에 금지한다.
- 한 번에 Tkinter를 제거하려 하면 자동화 로직 회귀 위험이 크다. 먼저 agent mode를 추가하고, 이후 worker 분리를 단계적으로 진행한다.

## 현재 완료된 것

운영 서버:

- 웹앱: `https://api.aimax.ai.kr/app`
- API: `https://api.aimax.ai.kr/api`
- Oracle SSH alias: `oracle-server`
- 직접 SSH 기준: `ssh -p 3333 ubuntu@100.69.85.89`
- 서버 코드 경로: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/oracle/aimax-reports-api`
- 서버 운영 경로: `/home/ubuntu/aimax-reports-api`
- 다운로드 파일 서버 경로: `/home/ubuntu/aimax-downloads`

이미 운영 배포된 웹앱 기능:

- 로그인/비밀번호 변경
- 예리/현주/통합 권한 기준 화면 표시
- `/api/workers` 직원 카탈로그
- Local Agent heartbeat/readiness 표시
- 작업 생성/작업 목록
- Agent job dispatch
- 오류 보고 및 내 오류 보고 목록
- 설치 파일 다운로드
- 업데이트 탭
- 대시보드/직원/작업/설정/업데이트/오류 보고 화면
- 왼쪽 내비게이션 고정, 오른쪽 main 스크롤 레이아웃

macOS/Windows 빌드 상태:

- macOS v1.0.1 DMG 3종은 2026-05-06 L1J 기준으로 재빌드/검증/운영 업로드 완료
- Windows v1.0.1 EXE 3종은 서버에 기존 파일이 있을 수 있으나, L1J 변경 전 빌드라면 stale로 취급
- 다음 우선순위는 Windows 환경에서 같은 L1J 변경을 포함해 EXE 3종을 다시 빌드/검증/업로드하는 것

## 2026-05-06 현재 phase 위치

완료:

- L0 제품 경계/보안 계약 동결
- L1A~L1D macOS headless Agent mode, packaging, smoke
- L1E macOS 다운로드 운영 반영
- L1F 웹 작업 설정 복원과 macOS 재배포
- L1G 키워드 과반복 완화와 기본 모델 정리
- L1H 원화 비용 표시, 이미지 개수 옵션, SEO 이미지 분석 준비
- L1I 실제 usage token 기반 원화 비용 저장, Gemini Flash 실제 네이버 임시저장 테스트
- L1J GPT/OpenAI 모델, OpenAI 이미지 경로, 사용자 입력 OpenAI key 저장, headless 로컬 보안 설정 창, 글자수 ±5% 보정, macOS DMG 3종 재빌드/운영 업로드

L1J 핵심 변경:

- GPT 모델 선택지: `gpt-5.4-mini`, `gpt-5-mini`
- OpenAI 글 생성: `content/ai_text.py`에서 OpenAI Responses API 사용
- OpenAI 이미지 생성: `content/openai_image.py`
- GPT 선택 시 OpenAI 이미지 우선, Gemini 이미지 실패 시 OpenAI fallback 가능
- 사용자 API key는 각 사용자 PC의 로컬 보안 설정 창에서 입력하고 OS 안전 저장소에 저장
- 개발자 개인 Keychain fallback, `minsu-api`, `security find-generic-password` 계열 제거
- headless `open_settings`는 기존 전체 UI 대신 작은 `AIMAX 로컬 보안 설정` 창을 열고 `done` 보고
- `word_count` 필드는 하위 호환 이름을 유지하지만 의미는 목표 글자수
- 글쓰기 결과는 목표 글자수 ±5%로 공통 보정
- job result에 `char_count`, `target_char_count`, KRW 비용, image provider count 저장

검증 완료:

- Python compile, Node server check, app.html script check
- Gemini/Claude/GPT 공통 mock 글자수 보정 테스트
- OpenAI `gpt-5-mini` 실제 800자 생성 테스트: 최종 777자, 4원
- headless Agent smoke: heartbeat, open_settings done, fake job dispatch, KRW/글자수 result
- Gemini Flash 실제 네이버 임시저장 테스트
- macOS DMG 3종 codesign/hdiutil 검증 및 운영 업로드

남은 것:

- Windows EXE 3종 최신 L1J 코드 포함 재빌드/업로드
- 첫 사용자 연결 UX 확정: 설치 파일 다운로드만으로는 Local Agent가 웹앱 계정에 자동 연결되지 않음
- Windows 설치 후 전체 UI 미노출 확인
- Windows `open_settings` 작은 설정 창 확인
- Windows heartbeat/job smoke
- 가능하면 GPT `gpt-5-mini` + OpenAI 이미지 1장 + `바이브코딩` 800자 + `save` 네이버 임시저장 실전 테스트

Windows 전달 문서:

- 상세 실행 지시서: `docs/windows_build_v1_0_1_handoff.md`
- 짧은 전달 프롬프트: `docs/windows_ai_build_prompt.md`

## 첫 실행 웹앱 연결 UX 기준

현재 다운로드 버튼은 설치파일을 받는 기능일 뿐이다. 정적 `.exe`/`.dmg` 파일을 내려받았다고 해서 자동으로 사용자의 웹앱 session token이 로컬 PC에 저장되지는 않는다.

개발 smoke에서는 `scripts/save_web_agent_session.py --email ...`로 session token을 OS credential store에 저장했지만, 일반 사용자는 이 스크립트를 실행하지 않는다. 따라서 새 PC/첫 사용자에게는 별도 연결 흐름이 필요하다.

MVP 기준으로 허용하는 첫 연결 흐름:

1. 사용자가 웹앱에서 설치파일을 다운로드한다.
2. 설치 후 실행기는 기존 전체 UI를 띄우지 않는다.
3. 저장된 웹앱 session token이 없으면 작은 `AIMAX 웹앱 연결` 창을 한 번 띄운다.
4. 사용자가 AIMAX 웹앱 이메일/비밀번호로 로그인한다.
5. 실행기는 `/api/auth/login` 결과의 session token을 Windows Credential Manager/macOS Keychain에 저장한다.
6. 이어서 작은 `AIMAX 로컬 보안 설정` 창을 열어 네이버 ID/PW와 AI API key를 로컬 안전 저장소에 저장한다.
7. 이후 실행기는 background Local Agent로 heartbeat/job polling을 시작한다.

이 방식은 자동 페어링은 아니지만, 서버에 네이버/API key를 저장하지 않으면서 신규 사용자의 막힘을 줄이는 현실적인 L1.5 MVP다.

더 나은 다음 구조:

- 웹앱이 로그인된 사용자에게 short-lived pairing token을 발급
- Local Agent가 `127.0.0.1` localhost pairing endpoint를 열어둠
- 웹앱의 `연결하기` 버튼이 pairing token을 localhost Agent에 직접 전달
- Agent가 session/device token을 OS credential store에 저장

이 localhost pairing bridge는 서버/웹앱/Agent 계약이 모두 바뀌므로 별도 phase로 진행한다. Windows AI가 임의로 서버 웹앱까지 수정하면 macOS와 운영 웹앱이 갈라질 수 있으므로, 첫 실행 연결 창은 우선 공통 Local Agent 코드에 넣는다.

## 현재 코드에서 중요한 지점

`app.py`

- `NaverBlogApp`는 legacy 전체 Tkinter UI와 설정, worker, web_agent polling을 여전히 쥐고 있다.
- `HeadlessNaverBlogAgent`가 추가되어 기존 worker 메서드를 화면 없이 실행한다.
- `__main__`은 `agent_mode_requested(args)` 결과에 따라 headless 또는 legacy UI를 고른다.
- frozen/PyInstaller 앱은 기본 headless로 실행되고, `--legacy-ui` 또는 `AIMAX_LEGACY_UI=1`일 때만 전체 UI를 연다.
- `_restore_web_agent_session`, `_web_agent_loop`, `_collect_web_agent_readiness`, `_start_remote_job`, `_worker_remote_job`가 Local Agent 경로에서 사용된다.
- headless `open_settings`는 `local_agent/runtime.py`의 작은 `AIMAX 로컬 보안 설정` 창을 열고 저장 결과를 command `done/failed`로 보고한다.
- 예리/현주 자동화 worker는 아직 `NaverBlogApp` 메서드에 묶여 있으므로, 대규모 worker 분리는 L4 이후로 미룬다.

`web_agent/client.py`

- 운영 API base URL 기본값: `https://api.aimax.ai.kr`
- 현재 web session token은 keyring에 저장한다.
- `login`, `me`, `heartbeat`, `next_job`, `next_command`, `update_job` 등이 존재한다.

`oracle/aimax-reports-api/server.js`

- auth/users/jobs/agent heartbeat/commands/reports/downloads/workers/version이 있다.
- readiness sanitize에 `openai`, `selected_model`, `selected_model_ready`가 포함된다.
- job result sanitize에 KRW 비용, image provider count, `char_count`, `target_char_count`가 포함된다.
- 아직 사용자 세션과 device/agent 세션은 충분히 분리되어 있지 않다.
- 현재 Agent는 사용자 session token을 이용해 heartbeat/job polling을 한다.

`oracle/aimax-reports-api/static/app.html`

- 웹앱은 운영 콘솔 형태로 많이 정리되었다.
- GPT 모델 선택, 이미지 개수, 원화 비용 추정, 글자수 결과 표시가 반영되어 있다.
- 아직 웹앱 설정 입력이 localhost bridge로 직접 저장되는 완성 구조는 아니다.

## 지금부터 새로 진행할 Phase

아래는 Local Agent 전용화의 전체 phase 설계다. 2026-05-06 현재 L1J와 L1K 문서화까지 완료했으며, 다음 실제 실행 우선순위는 L8 Windows 반영이다. 기존 `docs/aimax_ai_staff_console_phase.md`의 UI phase는 이 Windows 게이트가 끝나기 전까지 다시 밀지 않는다.

### Phase L0. 제품 경계/보안 계약 동결

목적: 새 구조를 코드 수정 전에 확정한다.

범위:

- 웹앱/서버/Local Agent/사용자 PC의 책임 분리
- 민감정보 저장 금지 목록 확정
- Agent mode와 Legacy UI 접근 정책 확정
- 설정 전달 방식 1차 결정

산출물:

- 이 문서 확정
- `docs/local_agent_transition_phase.md` 또는 이 문서의 phase section 확정

검증:

- “설치 파일을 왜 받는가?”에 대한 답이 명확해야 한다.
- 답: “웹앱 작업을 내 PC에서 안전하게 실행하기 위한 AIMAX 실행기 설치입니다.”

### Phase L1. macOS Agent Mode 추가

목적: 일반 사용자 실행 시 기존 전체 Tkinter UI가 뜨지 않게 한다.

범위:

- `app.py`에 agent 전용 진입점 추가
- 예: `--agent`, `AIMAX_AGENT_MODE=1`
- agent mode에서는 전체 UI를 만들지 않는다.
- 저장된 session token이 있으면 자동 heartbeat/job polling 시작
- session token이 없으면 웹앱에 “설치됨, 연결 대기/페어링 필요” 상태를 보여줄 준비를 한다.
- legacy 전체 UI는 `--legacy-ui`, `AIMAX_LEGACY_UI=1`, 또는 개발 빌드에서만 열리게 한다.

산출물:

- `agent_main.py` 또는 `app.py` 내 agent entrypoint
- 기존 `NaverBlogApp` 전체 UI와 분리된 최소 agent loop

검증:

- `python app.py --agent` 실행 시 기존 전체 Tkinter 화면이 뜨지 않는다.
- heartbeat가 서버에 정상 전송된다.
- 웹에서 작업을 만들면 agent mode가 job을 수신한다.
- 기존 `python app.py --legacy-ui` 또는 개발 실행에서는 전체 UI를 열 수 있다.

주의:

- 처음부터 worker를 모두 분리하려 하지 말 것.
- 필요하면 내부적으로 Tk root를 숨겨서라도 1차 agent mode를 만들 수 있다.
- 단, 사용자에게 전체 UI가 보이면 안 된다.

### Phase L2. 설치 후 자동 실행

목적: 사용자가 설치 후 프로그램을 직접 열지 않아도 자동 연결되게 한다.

macOS:

- LaunchAgent 등록
- 로그인 시 Agent 자동 시작
- 앱 번들/실행 파일 위치 고정
- 재부팅 후 heartbeat 확인

Windows:

- 시작 프로그램, Scheduled Task, 또는 서비스/트레이 구조 중 선택
- DPAPI 저장과 함께 설계
- Windows는 macOS 검증 후 반영

산출물:

- macOS 설치 후 자동 실행 스크립트/설정
- 패키징 문서 업데이트

검증:

- 설치 후 별도 전체 UI가 뜨지 않는다.
- 재부팅 또는 로그아웃/로그인 후 웹앱에서 자동 연결된다.

### Phase L3. 웹앱 설정 입력을 로컬 저장으로 연결

목적: 사용자는 웹앱에서 네이버 ID/PW/API Key를 입력하지만 서버에는 저장하지 않는 구조를 만든다.

권장 1차 방식:

- Local Agent가 `127.0.0.1` localhost 설정 endpoint를 연다.
- 웹앱은 pair token 또는 local challenge로 브라우저에서 Local Agent에 직접 전달한다.
- Agent는 Keychain/DPAPI에 저장한다.
- 서버는 readiness만 heartbeat로 받는다.

대안:

- 서버가 opaque encrypted blob만 중계하고, 복호화는 Local Agent만 한다.
- 이 방식은 구현 복잡도가 올라가므로 1차 MVP에서는 localhost direct bridge가 현실적이다.

산출물:

- Local Agent settings endpoint
- 웹앱 설정 폼
- 저장 성공/실패 상태

검증:

- 서버 데이터/로그에 네이버 PW/API Key 원문이 없다.
- 설정 후 readiness가 `ready`로 바뀐다.
- Agent 재시작 후 설정이 유지된다.

### Phase L4. 기존 worker 로직과 UI 분리

목적: 예리/현주 자동화 로직을 웹 job에서 안정적으로 실행하게 한다.

범위:

- `_worker_write`, `_worker_neighbor` 등 기존 로직을 UI 의존 없이 호출 가능한 형태로 정리
- 설정 읽기/저장 모듈 분리
- queue/log UI 의존을 agent log/report 구조로 우회
- Tkinter 변수 의존성 제거 또는 adapter로 감싼다.

산출물:

- `agent/runner.py` 또는 `local_agent/runner.py`
- worker payload adapter
- 기존 UI와 agent mode 공용 실행 로직

검증:

- 기존 legacy UI에서 예리/현주 작업이 그대로 동작한다.
- agent mode에서 같은 로직이 웹 job으로 동작한다.
- Selenium/Chrome 흐름이 깨지지 않는다.

### Phase L5. 서버 기기 세션/기기 등록 강화

목적: 사용자가 로그인만 돌려 쓰는 위험을 줄이고, 관리자가 권한을 쉽게 열고 닫게 한다.

범위:

- 사용자 session과 device/agent token 분리
- `device_id`, `install_id`, `device_label`, `public_key` 또는 fingerprint 저장
- 계정당 허용 기기 수 정책
- 관리자 기기 해제/재등록
- 권한 회수 시 다음 heartbeat/job부터 차단

권장 API:

- `POST /api/agents/register`
- `POST /api/agents/heartbeat`
- `POST /api/device/pairing-token`
- `POST /api/admin/users/:id/devices/revoke`

검증:

- 같은 계정으로 새 기기 연결 시 정책에 따라 제한된다.
- 관리자가 기기를 해제하면 다음 연결 때 재등록이 필요하다.
- 권한 회수 후 Agent job 수신이 차단된다.

### Phase L6. 웹앱 본체 UX 완성

목적: 사용자가 Local Agent 화면을 볼 필요 없이 웹앱만으로 운영한다.

범위:

- 설정 페이지에서 네이버 계정/API Key/멘트 저장
- Agent 연결/미연결/설정 부족 상태 표시
- 작업 생성/상태/로그
- 오류 보고/내 오류 보고
- 업데이트 안내

검증:

- 사용자는 웹앱만 보고 작업 가능
- Local Agent 화면을 열지 않아도 된다.
- 설치, 설정, 작업, 오류 보고가 한 흐름으로 이어진다.

### Phase L7. macOS 재빌드/E2E

목적: macOS에서 진짜 사용자 흐름을 먼저 검증한다.

검증 시나리오:

1. 웹앱 로그인
2. 설치 파일 다운로드
3. DMG 설치
4. 설치 후 기존 전체 UI가 뜨지 않음
5. 웹앱에서 Local Agent 연결 확인
6. 웹앱에서 네이버/API 설정
7. 웹앱에서 예리/현주 작업 생성
8. 로컬 Chrome/Selenium 실행
9. 오류 보고 전송
10. 재부팅 후 자동 연결

### Phase L8. Windows 반영

목적: macOS에서 검증된 구조를 Windows에 반영한다.

범위:

- Windows agent mode
- 자동 시작 방식 확정
- DPAPI/Credential Manager 저장
- Windows 설치파일 빌드 문서 업데이트
- Windows EXE 재빌드/업로드

검증:

- Windows에서도 설치 후 전체 UI가 뜨지 않는다.
- 웹앱에서만 작업 가능하다.
- 재부팅 후 자동 연결된다.

## 바로 다음 세션에서 할 일

1. 이 문서를 읽는다.
2. `app.py`에서 `NaverBlogApp` 초기화, `_web_agent_loop`, `_start_remote_job`, `__main__` 구조를 다시 확인한다.
3. `Phase L1. macOS Agent Mode 추가`를 작은 구현 단위로 쪼갠다.
4. 기존 전체 UI를 없애기보다 먼저 `--agent` 모드를 추가한다.
5. `python app.py --agent`가 전체 UI 없이 heartbeat/job polling 가능하게 만든다.
6. 로컬에서 `--legacy-ui`는 계속 열리게 유지한다.
7. macOS 빌드/설치파일 진입점을 agent mode로 바꾸는 계획을 세운다.

## 지금 하면 안 되는 일

- 웹앱 UI만 계속 다듬기
- 기존 전체 Tkinter UI를 사용자 설치파일에 그대로 두기
- 네이버 PW/API Key를 서버 DB에 저장하는 구현
- Windows부터 먼저 고치기
- worker 로직을 한 번에 대규모 리팩터링하기
- 결제 자동화 먼저 붙이기

## 성공 기준

최종 성공 기준은 아래 한 문장이다.

> 사용자는 웹앱만 사용하고, 설치 파일은 내 PC에서 네이버 자동화를 안전하게 실행하기 위한 보이지 않는 Local Agent를 설치하는 역할만 한다.

이 기준에 맞지 않는 결정은 뒤로 미룬다.
