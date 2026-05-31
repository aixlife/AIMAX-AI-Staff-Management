# Windows Handoff - Songi Web Secret Storage Follow-up

작성: 2026-05-22 19:22 KST

## 먼저 읽을 문서

1. `MAC_COMPLETION_20260522_web_secret_songi_deployed.md`
2. 운영 배포 보고서: `docs/deployments/oracle-deploy-20260522-191551.md`

## 배경

운영 오류보고에서 송이 Apify 키 인식 문제가 확인됐다.

대표 보고:
- `AIMAX-RPT-20260521063153-e9f89e1f`: 송이 화면에 `Apify 키 필요`
- `AIMAX-RPT-20260522050646-d9ab7f2b`: Apify API Key를 넣었는데도 인식 못함, Instagram 영상/프로필 분석 불가

원인:
- Apify 토큰이 Windows/Mac 실행기 로컬 설정에만 저장됨
- 송이는 웹/서버에서 실행되는 `web-first` 직원이라 로컬 실행기 저장 토큰을 직접 사용할 수 없음

Mac/Oracle 조치:
- 설정 탭에 `AI/API 연결` 추가
- 사용자별 API 키 암호화 저장 API 배포
- 송이 Apify/Gemini 실행 경로가 사용자 웹 저장 키를 먼저 사용하도록 변경

## Windows 쪽 원칙

송이를 로컬 실행기 필수 직원으로 되돌리지 마세요.

직원 구분:
- 블로그팀 예리/현주: 네이버 브라우저 자동화 때문에 로컬 실행기 필요
- 송이: 기본값은 웹 실행, 로컬 실행기 불필요
- 앞으로 직원 추가 시에도 `web-first`, `local-agent-required`, `hybrid`를 먼저 판단

민감정보 구분:
- Naver ID/password, browser session, cookies: 이 PC 로컬 저장 유지
- Gemini/OpenAI/Claude/Apify API keys: 웹 보안 저장소에서 사용자별 암호화 저장 가능
- raw key, cookies, `.env`, browser profile, private logs는 Syncthing/보고서에 포함 금지

## Windows에서 확인할 일

### 1. 최신 웹앱 동작 확인

Windows 브라우저에서:
- `https://api.aimax.ai.kr/app` 새로고침
- 설정 탭에 `AI/API 연결` 섹션이 보이는지 확인
- Gemini/Apify/OpenAI/Claude 저장 버튼과 삭제 버튼이 보이는지 확인
- Apify가 없을 때 송이 화면이 로컬 실행기 설치를 요구하지 않고 웹 API 연결을 안내하는지 확인

무비용 체크만 수행:
- 실제 Apify 수집 버튼 승인 금지
- 실제 Gemini 분석 승인 금지
- 실제 Naver 저장/발행 금지

### 2. Windows 로컬 설정 UI 문구 정리

현재 Windows 로컬 설정 창에 Apify/Gemini/OpenAI/Claude 입력칸이 있다면 사용자 혼동이 생길 수 있다.

권장:
- 네이버 ID/비밀번호는 `블로그팀 로컬 보안 설정`으로 명확히 유지
- API 키 입력칸은 `기존/블로그팀 로컬 사용` 또는 `웹 설정에서 관리 권장`으로 문구 수정
- Songi/Apify 설명에서 “로컬 설정에 넣으면 송이가 바로 인식한다”는 식의 문구가 있으면 제거
- API 키 발급 가이드 버튼은 웹 설정 탭 안내와 충돌하지 않게 유지

주의:
- 지금 당장 API 키 입력칸을 삭제하지 마세요. 예리 글쓰기 로컬 실행 경로가 아직 로컬 API 키를 사용할 수 있습니다.
- 대신 송이용 Apify는 웹 `AI/API 연결`에 저장해야 한다고 안내하세요.

### 3. 자동 이전 기능은 다음 단계로 분리

사용자가 기존 실행기에 저장한 API 키를 웹 보안 저장소로 가져오는 기능은 아직 운영 배포 범위에 포함되지 않았다.

구현한다면 아래 contract로 Mac/Windows 모두 같은 방식이어야 한다:
- 웹에서 사용자가 `기존 실행기 키 가져오기`를 클릭
- 로컬 실행기가 명령을 받음
- 로컬 실행기는 provider API keys만 읽음
  - `gemini_api_key`
  - `openai_api_key`
  - `claude_api_key`
  - `apify_api_token`
- Naver password/cookies/browser profile/session은 절대 전송하지 않음
- 실행기는 `PUT /api/user/secrets/:provider`로 HTTPS 업로드
- 로그에는 provider명과 success/fail만 기록, raw value 절대 기록 금지
- 사용자가 체크한 provider만 이전

아직 웹 UI의 import 버튼/command type은 Mac 쪽에서 별도 확정해야 하므로, Windows에서 단독으로 임의 command type을 만들지 말고 의견과 필요한 변경점만 반환하세요.

## 검증 기준

Windows 개발자는 완료 보고에 아래를 포함해주세요.

- 현재 Windows 소스/설치본 버전
- 설정 탭 `AI/API 연결` 확인 결과
- 송이 화면에서 Apify 미연결 안내가 웹 설정으로 이어지는지
- 로컬 설정 창 문구 충돌 여부
- v1.0.15 다운로드/로컬 설정 열기 기존 핫픽스가 계속 정상인지
- 유료 API/Apify/Naver 발행을 실행하지 않았다는 확인
- 자동 이전 기능에 필요한 Mac/server 추가 contract 제안이 있으면 별도 목록

## 금지

- 고객 데이터, API keys, cookies, `.env`, browser profiles, signed URLs 공유 금지
- Apify/Gemini/Claude/OpenAI 유료 호출 금지
- Naver 발행/저장 테스트 금지
- Songi를 local-agent-required로 바꾸는 구조 변경 금지
