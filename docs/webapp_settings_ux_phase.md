# AIMAX Web App Settings UX Phase Plan

작성일: 2026-05-05

## 배경

현재 웹앱은 로그인, 다운로드, 작업 생성, 오류 보고, 로컬 Agent 상태 확인을 빠르게 검증하기 위한 MVP 콘솔에 가깝다. 실제 사용자가 예리/현주 직원을 쓰기 전 필요한 네이버 계정, AI API Key, 서로이웃 멘트, Chrome/Selenium 상태 같은 준비 흐름이 제품 구조로 정리되어 있지 않다.

## AI Council 반영

이번 실시간 Council 호출은 로컬 CLI 문제로 완료되지 않았다.

- Claude CLI: API 연결 실패
- Gemini CLI: 브라우저 인증 대기 상태로 중단

대신 같은 프로젝트에서 직전에 저장된 Claude/Gemini Council 결과를 반영한다.

공통 판단:

- 네이버 자동화는 클라우드 서버가 아니라 사용자 PC의 로컬 Agent가 실행해야 한다.
- 서버는 계정, 권한, 작업 큐, 오류 보고, 업데이트, 다운로드, 대시보드 같은 control plane 역할을 맡는다.
- 로컬 Agent는 네이버 로그인, Chrome/Selenium, API Key 사용, 실제 자동화 같은 data plane 역할을 맡는다.
- 네이버 PW/API Key를 서버에 저장하거나 웹앱으로 전송하는 구조는 피한다.

Codex 판단:

- 사용 편의성을 위해 웹앱에서 설정 흐름을 안내하되, 민감값 원문 입력/저장은 로컬 실행기의 보안 입력창에서 처리한다.
- 웹앱에는 원문 값이 아니라 `설정됨/미설정/점검 실패` 같은 readiness 상태만 표시한다.
- Windows 빌드는 readiness API 계약이 확정된 뒤 진행한다. 그렇지 않으면 Windows 빌드를 다시 해야 한다.

## 핵심 결정

채택할 구조는 **Guided Local Secure Setup**이다.

웹앱:

- 사용자가 무엇을 먼저 해야 하는지 체크리스트로 안내한다.
- 각 직원이 사용 가능한지 상태를 보여준다.
- 설정이 부족하면 작업 폼보다 “로컬 실행기에서 설정 열기”를 먼저 보여준다.
- 민감정보 원문은 저장하지 않는다.

로컬 실행기:

- 네이버 ID/PW, Gemini API Key, Claude API Key를 OS keyring에 저장한다.
- 서로이웃 멘트와 비민감 설정은 기존 settings 파일 구조를 사용한다.
- 웹앱 로그인 후 heartbeat에 readiness 상태만 보낸다.
- 웹앱에서 받은 `open_settings` 같은 제어 명령을 받아 설정 화면을 열 수 있게 한다.

서버:

- Agent readiness 상태를 저장하고 웹앱에 노출한다.
- readiness 상태는 boolean/상태 문자열만 저장한다.
- 네이버 PW/API Key 원문을 받지 않는다.

## Readiness Contract 초안

로컬 Agent heartbeat payload에 아래 `readiness`를 추가한다.

```json
{
  "readiness": {
    "web_login": true,
    "naver_account": {
      "status": "ready",
      "has_id": true,
      "has_password": true
    },
    "ai_keys": {
      "gemini": "ready",
      "claude": "missing",
      "selected_model": "gemini-3.1-pro-preview"
    },
    "neighbor_messages": {
      "status": "ready",
      "count": 3
    },
    "browser": {
      "status": "unknown",
      "last_check_at": null
    },
    "workers": {
      "yeri_write": "ready",
      "hyunju_find": "ready"
    }
  }
}
```

허용 상태값:

- `ready`
- `missing`
- `needs_attention`
- `unknown`
- `unavailable` (split 실행기에서 해당 직원 기능을 제공하지 않을 때)

금지:

- 네이버 비밀번호 원문
- API Key 원문
- 쿠키/세션
- 로컬 파일 경로 전체

## 목표 UX 구조

### 1. 대시보드

목적: 사용자가 지금 무엇을 해야 하는지 즉시 알게 한다.

구성:

- 시작 준비 체크리스트
- 로컬 실행기 연결 상태
- 직원별 사용 가능 여부
- 최근 작업
- 오류 보고 빠른 진입

체크리스트 예:

1. 웹앱 로그인 완료
2. 로컬 실행기 설치/연결
3. 네이버 계정 설정
4. AI Key 설정
5. 현주 멘트 설정
6. 테스트 작업 1회 실행

### 2. 직원

목적: 예리/현주가 무엇을 하는지, 사용 가능한지 확인한다.

구성:

- 프로필 사진
- 역할 설명
- 필요한 설정
- 현재 readiness
- 설정 부족 시 작업 버튼 대신 설정 안내

### 3. 작업

목적: 준비된 직원에게만 작업을 지시한다.

구성:

- 예리 작업 폼
- 현주 작업 폼
- readiness 부족 시 작업 생성 차단
- 왜 차단되는지 명확히 표시

### 4. 설정

목적: 웹앱은 설정 상태를 보여주고, 민감값 입력은 로컬 실행기로 연결한다.

구성:

- 계정/비밀번호 변경
- 설치파일 다운로드
- 로컬 실행기 연결 상태
- 네이버 계정: 설정됨/미설정
- AI Key: Gemini/Claude 설정됨/미설정
- 현주 멘트: 저장 개수
- “로컬 실행기 설정 열기” 버튼

### 5. 오류 보고

목적: 기존 오류 보고 흐름 유지.

구성:

- 웹 오류 보고
- 로컬 앱 오류 보고 안내
- 전송된 report id 표시

## Phase Plan

## 진행 기록

2026-05-05 현재 반영 완료:

- `web_agent/client.py` heartbeat에 `readiness` payload 옵션 추가

2026-05-07 추가 반영:

- 웹앱 대시보드에 `첫 사용자 가이드` 패널을 추가했다.
- 가이드는 현재 상태를 읽어 한 번에 하나의 다음 단계만 크게 안내한다.
- 안내 순서:
  1. 첫 로그인 비밀번호 변경
  2. 실행기 설치
  3. 실행기 연결
  4. 로컬 보안 설정 열기
  5. 웹 작업 설정
  6. 첫 작업 테스트
- API Key 원문은 웹앱에 입력하지 않는다.
- 사용자는 `로컬 설정 열기`로 뜨는 `AIMAX 로컬 보안 설정` 창에 네이버 ID/PW와 Gemini/Claude/OpenAI API Key를 입력한다.
- 입력된 민감정보는 사용자 PC의 OS 안전 저장소에만 저장된다.
- `app.py`, `split_version/app.py`에서 네이버 계정, AI Key, 서로이웃 멘트, 브라우저, 직원별 readiness 수집
- split 실행기는 `APP_MODE` 기준으로 제공하지 않는 직원 작업을 `unavailable`로 표시
- Oracle API 서버가 readiness를 sanitize 후 `agents.json`에 저장하고 `/api/agent/status`에 노출
- 웹앱 대시보드에 시작 체크리스트 추가
- 웹앱 설정 탭 추가
- 작업 폼은 계정 권한, 로컬 실행기 연결, readiness 상태에 따라 차단 사유를 표시
- 서버 command 큐(`/api/agent/commands`, `/api/agent/next-command`, `/api/agent/commands/update`) 추가
- 웹앱 “로컬 설정 열기” 버튼이 `open_settings` 명령을 생성
- 로컬 Agent가 `open_settings` 명령을 받으면 직원 설정 패널을 foreground로 표시
- macOS DMG 3종을 새 Agent 코드로 재빌드하고 운영 다운로드 폴더에 업로드

검증 완료:

- `python -m py_compile app.py split_version/app.py web_agent/client.py`
- `node --check oracle/aimax-reports-api/server.js`
- `app.html` 인라인 스크립트 문법 확인
- 운영 API smoke: readiness `yeri_write/hyunju_find=ready`, `open_settings` command 수신/완료, 예리/현주 job dispatch `done`
- `hdiutil verify` 통과: `aimax-bundle-macos.dmg`, `aimax-yeri-macos.dmg`, `aimax-hyunju-macos.dmg`
- Windows EXE 3종 운영 업로드 완료 및 `/api/downloads/options`에서 Windows `bundle/yeri/hyunju` 모두 `exists: true` 확인
- 2026-05-06 L1J 이후 GPT/OpenAI, OpenAI 이미지, 작은 로컬 보안 설정 창, 글자수 ±5% 보정이 추가되었으므로 기존 Windows EXE는 최신 기능 기준으로 다시 재빌드/업로드해야 함

남은 작업:

- L1J 기준 Windows EXE 3종 재빌드/업로드
- Windows 설치 후 전체 UI 미노출, `open_settings` 작은 설정 창, heartbeat/job smoke 확인

## Phase 0. 구조 동결

목적: Windows 빌드 전에 웹앱/Agent 계약을 고정한다.

범위:

- 웹앱 메뉴 구조 확정
- readiness contract 확정
- 민감정보 저장 원칙 확정
- “웹에서 입력 가능한 것”과 “로컬에서만 입력 가능한 것” 구분

산출물:

- 이 문서 확정본
- `docs/windows_build_v1_0_1_handoff.md`에 readiness 계약 반영

검증:

- 네이버 PW/API Key가 서버 payload에 포함되지 않음
- Mac/Windows 양쪽이 같은 계약을 구현할 수 있음

## Phase 1. Local Agent Readiness API

목적: 웹앱이 로컬 실행기의 준비 상태를 보여줄 수 있게 한다.

범위:

- `web_agent/client.py` heartbeat payload 확장
- `app.py` readiness 수집 함수 추가
- `split_version/app.py` 동일 반영
- 서버 `agents.json`에 readiness 저장
- `/api/agent/status` 응답에 readiness 포함

산출물:

- 웹앱이 `naver_account`, `ai_keys`, `neighbor_messages`, `workers` 상태를 조회 가능

검증:

- 민감정보 원문이 서버에 저장되지 않음
- 네이버 ID는 필요 시 마스킹 또는 boolean만 전송
- 예리/현주 권한별 readiness가 올바르게 계산됨

## Phase 2. Web App IA 재정리

목적: 현재 끼워넣기식 대시보드를 사용자 온보딩 중심으로 재구성한다.

범위:

- 대시보드 체크리스트
- 직원 상세/작업 분리
- 설정 탭 추가
- 작업 탭은 준비 완료 후 사용 가능하게 변경
- 빈 상태/차단 사유 문구 정리

산출물:

- `static/app.html` 정보구조 재정리
- 직원 프로필은 유지하되 작업 폼과 섞이지 않게 배치

검증:

- 신규 사용자가 다음 행동을 알 수 있음
- 설정 미완료 상태에서 작업을 잘못 생성하지 않음
- 모바일/데스크톱에서 UI 겹침 없음

## Phase 3. 로컬 설정 열기 흐름

목적: 사용자가 웹앱에서 막히면 자연스럽게 로컬 실행기의 설정 화면으로 이동하게 한다.

범위:

- 서버 job/command 타입에 `open_settings` 또는 `open_local_settings` 추가
- 로컬 Agent가 해당 command를 받으면 설정 패널을 foreground로 표시
- 웹앱 버튼: “로컬 실행기에서 설정 열기”

산출물:

- 웹앱에서 설정 필요 항목 클릭 → 로컬 실행기 설정 화면 열림

검증:

- 로컬 실행기가 연결되어 있을 때만 버튼 활성화
- 민감값은 로컬 창에만 입력
- command 처리 실패 시 웹앱에 안내

## Phase 4. Mac E2E 재검증

목적: 구조 변경 후 Mac 기준 전체 흐름을 다시 확인한다.

범위:

- 신규 계정 로그인
- 설치파일 다운로드 상태
- readiness missing/ready 표시
- 로컬 설정 후 readiness 갱신
- 예리/현주 작업 생성
- 실제 네이버 작업 직전까지 smoke test

산출물:

- Mac E2E smoke 통과 기록

검증:

- readiness 상태 변화가 웹앱에 반영됨
- 작업 생성 차단/허용이 정확함

## Phase 5. Windows handoff 업데이트 및 빌드

목적: 확정된 계약으로 Windows 빌드를 진행한다.

범위:

- Windows 문서에 readiness contract 반영
- Windows 코드에 `web_agent`, readiness, settings command 반영 확인
- Windows EXE 설치파일 3종 빌드
- 서버 업로드
- Windows E2E smoke test

산출물:

- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`

검증:

- Windows 웹앱 다운로드 활성화
- Windows 로컬 Agent readiness 표시
- Windows 작업 수신 smoke 통과

## Phase 6. Lazyweb MCP UI Design Pass

목적: 기능 연결이 끝난 뒤 웹앱 UI를 실제 SaaS/업무 도구 레퍼런스 기반으로 다듬어 사용자가 더 자연스럽게 설정, 작업 지시, 오류 보고를 진행하게 한다.

판단:

- Lazyweb는 실제 앱 화면과 사용자 플로우 레퍼런스를 AI가 검색/비교하는 데 적합하다.
- AIMAX에는 `Onboarding`, `Sign In`, `Settings`, `Dashboard & Home`, `Permissions`, `Profile` 같은 Lazyweb 플로우가 특히 유용하다.
- 이 phase는 서버 웹앱 스타일/구조 개선이므로 로컬 Agent/Windows 빌드를 다시 요구하지 않는 범위에서 우선 진행한다.

범위:

- Lazyweb MCP 연결 가능 여부 확인
- 온보딩/설정/대시보드/직원 프로필/오류 보고 레퍼런스 수집
- AIMAX용 UI style brief 작성
- 현재 `static/app.html`의 정보구조는 유지하되 spacing, hierarchy, cards, empty state, status labels, action priority 개선
- 필요한 경우 웹앱 화면을 `대시보드`, `설정`, `작업`, `오류 보고` 기준으로 시각적 재정렬

산출물:

- `docs/lazyweb_ui_style_brief.md`
- `oracle/aimax-reports-api/static/app.html` UI refinement
- 가능하면 주요 화면 before/after 캡처

진행 기록:

- 2026-05-05: 현재 Codex 세션에 Lazyweb MCP 리소스/템플릿이 연결되어 있지 않음을 확인
- 2026-05-05: Lazyweb 공개 레퍼런스 기반 1차 style brief 작성: `docs/lazyweb_ui_style_brief.md`
- 2026-05-05: `static/app.html` 1차 UI refinement 적용 및 운영 배포
  - 대시보드 `다음 행동` 영역 추가
  - 설정 탭 readiness step layout 적용
  - 작업 폼 차단 사유를 `job-blocker` notice로 표시
- 2026-05-05: Lazyweb Codex 플러그인 설치 준비 완료
  - 로컬 토큰 파일: `~/.lazyweb/lazyweb_mcp_token`
  - Codex marketplace: `https://github.com/aboul3ata/lazyweb-skill`
  - Codex config: `[plugins."lazyweb@lazyweb"] enabled = true`
  - MCP 직접 검증: `tools/list`에서 `lazyweb_health`, `lazyweb_search` 확인, `lazyweb_health` healthy, `lazyweb_search {"query":"pricing page","limit":3}` 응답 확인
  - 현재 Codex 프로세스 재시작 후 네이티브 도구 목록에 Lazyweb 도구가 노출되는지 최종 확인 필요
- 2026-05-05: Codex 재시작 후 `codex mcp list`에서 `lazyweb` enabled 확인
- 2026-05-05: Lazyweb MCP 실제 검색 결과로 `docs/lazyweb_ui_style_brief.md` 보강
- 2026-05-05: `static/app.html` 2차 UI refinement 적용 및 운영 배포
  - 시작 체크리스트/설정 단계에 진행 index 추가
  - 직원 상세 카드에 사용 가능/설정 필요 상태와 바로가기 CTA 추가
  - 오류 보고 제출 후 report id를 화면 안에 접수 상태로 표시
  - 오류 보고 수집/보호/처리 기준을 단계형 안내로 정리
- 2026-05-05: 첫 로그인 비밀번호 변경 UX 수정 및 운영 배포
  - 첫 로그인 강제 변경 상태에서는 현재 비밀번호 재입력을 요구하지 않고 새 비밀번호만 받음
  - `invalid_current_password`, `password_too_short`, `password_contains_email` 오류를 한국어 안내로 표시
  - 로컬 API 테스트: 임시 계정 생성 → 로그인 → 현재 비밀번호 없이 변경 → `canExecute: true` 통과

검증:

- 모바일/데스크톱에서 텍스트 겹침 없음
- 설정 미완료 상태에서 작업 생성 차단이 계속 동작
- 네이버 PW/API Key 원문을 웹앱에 입력하거나 서버에 보내지 않음
- Lighthouse 또는 브라우저 smoke 수준의 접근성/콘솔 오류 확인
- Lazyweb 레퍼런스는 참고만 하고 특정 앱 UI를 그대로 복제하지 않음
- `app.html` 인라인 스크립트 문법 확인
- 운영 URL `/app`에서 `employeeDetailStatus`, `reportResult`, `setup-index` 서빙 확인
- 비밀번호 변경 API 로컬 smoke 통과

## 권장 진행 순서

1. 이 문서로 Phase 0 확정
2. Phase 1 readiness API 구현
3. Phase 2 웹앱 IA 재정리
4. Phase 3 로컬 설정 열기 command 구현
5. Mac E2E
6. Windows 문서 업데이트
7. Windows 빌드
8. Lazyweb MCP UI Design Pass

## 보류

- 웹앱에 네이버 PW/API Key 원문 입력
- 서버에 민감정보 암호화 저장
- 클라우드 Selenium 실행
- Windows 먼저 빌드
