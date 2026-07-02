# Mac/Oracle Completion - Songi Web Secret Storage

작성: 2026-05-22 19:22 KST

## 목적

송이 자료조사원이 Apify 토큰을 실행기 로컬 설정에 저장했는데도 웹 송이 실행 경로에서 인식하지 못하던 문제를 해결한다.

제품 판단:
- 송이는 `web-first` 직원이다.
- Apify/Gemini 키는 웹에서 사용자별로 입력하고 서버에서 암호화 저장한다.
- 네이버 ID/비밀번호와 브라우저 세션은 블로그팀 실행기 로컬 저장으로 유지한다.

## Mac/Oracle 완료

수정 파일:
- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `scripts/smoke_user_secrets.mjs`
- `scripts/mark_20260522_web_secret_reports.mjs`

운영 배포:
- 배포 시각: 2026-05-22 19:17 KST
- 배포 보고서: `docs/deployments/oracle-deploy-20260522-191551.md`
- `server.js` SHA: `97a03718cfc8166e73f93aebbf51a1b5934b6098bb65d4c131f9529c2682cd1a`
- `app.html` SHA: `ff5c0f232913e2a76ebfa859336b57a24d5b2bf9ccd02a47d73a78c60b346ee5`

운영 서버 재시작 중 기존 orphan `node server.js` 프로세스가 `127.0.0.1:18988`을 잡고 있어 한 번 실패했다. PID `3197732`만 종료 후 서비스를 정상 재시작했다.

## 새 서버 기능

신규 API:
- `GET /api/user/secrets`
- `PUT /api/user/secrets/:provider`
- `DELETE /api/user/secrets/:provider`

지원 provider:
- `gemini` -> `GEMINI_API_KEY`
- `openai` -> `OPENAI_API_KEY`
- `claude` -> `CLAUDE_API_KEY`
- `apify` -> `APIFY_API_TOKEN`

저장 방식:
- 사용자별 AES-256-GCM 암호화 저장
- 응답은 상태/소스/갱신 시각만 반환
- 원문 키는 응답, 로그, 오류 보고에 반환하지 않음
- 운영에서 별도 `AIMAX_USER_SECRET_ENCRYPTION_KEY`가 없으면 서버 로컬 key file로 암호화 키를 생성해 사용

송이 실행 경로:
- Apify/Gemini 실행 시 사용자 웹 저장 키를 먼저 사용
- 없으면 기존 서버 전역 키를 fallback
- 로컬 실행기 Apify 토큰은 송이 실행 조건으로 사용하지 않음

## 앱 UI 변경

설정 탭에 `AI/API 연결` 섹션 추가:
- Gemini API Key
- Apify API Token
- OpenAI API Key
- Claude API Key

송이 Apify 오류 메시지 변경:
- 기존: 로컬 실행기/PC 토큰 중심 안내
- 변경: 설정 탭의 AI/API 연결에서 웹 보안 저장소에 Apify 토큰을 저장하도록 안내

## 검증

로컬 무비용 검증:
- `node --check oracle/aimax-reports-api/server.js`
- app embedded script syntax: `APP_HTML_SCRIPT_SYNTAX_OK`
- `node scripts/smoke_user_secrets.mjs`
  - 로그인
  - 사용자별 Gemini/Apify 키 저장
  - `research/integrations`가 `web_user` 모드로 전환
  - Instagram URL 생성 시 `apify_needs_approval`
  - app 설정 탭 UI에서 `AI/API 연결`과 키 상태 확인
  - raw secret이 `user-secrets.json`에 평문 저장되지 않음

운영 검증:
- `GET https://api.aimax.ai.kr/api/reports/health` -> `ok=true`
- `GET https://api.aimax.ai.kr/app` contains `AI/API 연결`, `/api/user/secrets`, `웹 보안 저장소`
- 서비스 상태 `active (running)`

## 오류보고 정리

활성 오류 5건을 `사용자 확인 필요`로 변경했다.

Apify/Songi root cause:
- `AIMAX-RPT-20260521063153-e9f89e1f`
- `AIMAX-RPT-20260522050646-d9ab7f2b`

Windows download/settings retry:
- `AIMAX-RPT-20260522015806-4bcdf1df`
- `AIMAX-RPT-20260519111502-f4464f9a`

Old Windows image retry:
- `AIMAX-RPT-20260516091042-e77599e1`

현재 운영 오류보고 상태:
- `done`: 14
- `waiting_user`: 20
- `new/reviewing/working`: 0

## 남은 범위

기존 실행기에 이미 저장한 API 키 자동 이전은 아직 구현하지 않았다. 오늘 배포는 사용자가 웹 설정 탭에 직접 저장하면 바로 동작하는 구조까지다.

자동 이전을 만들 때의 원칙:
- 사용자 명시 클릭 후 provider API keys만 전송
- Naver password, cookies, browser profile, sessions는 절대 이전하지 않음
- raw key 로그/파일/공유 폴더 금지
- Mac/Windows 실행기 모두 같은 command contract로 구현
