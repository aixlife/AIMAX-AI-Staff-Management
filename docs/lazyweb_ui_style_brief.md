# AIMAX Lazyweb UI Style Brief

작성일: 2026-05-05

## 상태

Lazyweb MCP 서버 연결과 검색 검증을 완료했다.

- Codex MCP 등록: `codex mcp list`에서 `lazyweb` enabled 확인
- MCP tools 확인: `lazyweb_health`, `lazyweb_search`
- `lazyweb_health`: healthy
- `lazyweb_search {"query":"pricing page","limit":3}`: 응답 확인

이 문서는 Lazyweb MCP 조회 결과와 현재 AIMAX 웹앱 구조를 바탕으로 업데이트한 style brief다.

## Lazyweb에서 확인한 참고 방향

Lazyweb는 실제 앱 화면, 사용자 플로우, UI 패턴을 검색/비교하기 위한 디자인 리서치 라이브러리다. 공개 검색 결과 기준으로 특히 아래 플로우가 AIMAX에 맞는다.

- `settings`: 로컬 설정 상태, API Key, 네이버 계정, 비밀번호 변경
- `onboarding`: 신규 사용자가 설치/로그인/설정/첫 작업까지 가는 흐름
- `dashboard`: 현재 상태, 다음 행동, 최근 작업
- `profile`: 예리/현주 직원 카드와 상세 설명
- `verification`: 회원 인증/구매자 인증이 붙을 이후 단계
- `messaging`: 오류 보고와 상태 피드백

참고 후보:

- Appcues/Userpilot 계열: onboarding checklist, resource center, guided setup
- MAXIO/Chargify 계열: sandbox/dashboard/status 중심 운영 콘솔
- TestFlight/Apple Feedback 계열: service status, feedback assistant, 단계형 오류 보고
- Beli bugs page: 단순한 오류 보고 폼과 명확한 submit 흐름
- Intercom 계열: support handoff, ticket state, AI/human 상태 구분

## Lazyweb MCP 실제 검색 메모

검색 쿼리:

- `SaaS onboarding checklist dashboard settings desktop`
- `SaaS settings page API keys connected accounts desktop`
- `automation job queue status dashboard desktop SaaS`
- `error report feedback modal logs desktop SaaS`

반영할 패턴:

- 온보딩/설정은 긴 설명보다 `무엇이 끝났고 무엇이 남았는지`를 단계형으로 보여준다.
- 운영 콘솔은 좌측 내비게이션, 중앙 상태 패널, 우측 보조 액션 구조가 안정적이다.
- 작업/자동화 화면은 상태 pill, 최근 실행, 차단 사유, 재시도 액션을 가까이 배치한다.
- 오류 보고는 폼 자체를 짧게 유지하고, 접수 후 report id와 처리 상태를 즉시 보여준다.
- API Key나 계정 연결 설정은 원문 입력창보다 `설정됨/미설정/확인 필요` 상태와 연결 액션을 강조한다.

## AIMAX UI 원칙

AIMAX는 마케팅 랜딩페이지가 아니라 운영형 SaaS 콘솔이다.

- 첫 화면은 사용자가 “지금 뭘 해야 하는지” 바로 보여줘야 한다.
- 대시보드는 설명보다 상태와 다음 행동 중심이어야 한다.
- 설정이 안 된 상태에서는 작업 폼보다 설정 CTA가 먼저 보여야 한다.
- 네이버 PW/API Key 원문은 웹앱에 입력하지 않는다.
- 직원 프로필은 감성 요소로 쓰되, 작업 수행 가능 여부와 연결되어야 한다.
- 오류 보고는 고객지원 채널이 아니라 운영 워크플로우로 보여야 한다.

## 현재 웹앱의 개선 포인트

### 1. 대시보드

현재:

- 시작 체크리스트, 계정, 로컬 실행기, 최근 작업, 직원, 작업 지시가 한 화면에 모두 있다.

개선:

- 상단에 `다음 할 일` 한 줄을 둔다.
- 체크리스트는 4~5개 항목의 진행 상태로 압축한다.
- 준비가 안 된 항목은 바로 `설정 열기`, `설치 파일 다운로드`, `비밀번호 변경` CTA로 연결한다.
- 작업 폼은 readiness가 ready일 때만 강하게 보이고, missing 상태에서는 흐리게 보인다.

### 2. 설정 탭

현재:

- readiness 항목과 다운로드/로컬 설정 버튼이 분리되어 있다.

개선:

- `계정`, `로컬 실행기`, `네이버 설정`, `AI Key`, `현주 멘트`를 세로 단계로 보여준다.
- 각 단계는 `상태`, `필요 행동`, `마지막 확인`을 갖는다.
- `로컬 설정 열기`는 설정 탭의 primary action이다.
- 설치 파일 다운로드는 secondary action이다.

### 3. 직원 프로필

현재:

- 프로필 사진과 역할 설명은 좋지만 작업 가능 여부와 약하게 연결되어 있다.

개선:

- 직원 카드에 `사용 가능`, `설정 필요`, `권한 없음`, `이 실행기에서 미제공`을 명확히 표시한다.
- 직원 상세에는 필요한 설정을 pill로 보여준다.
- 예리/현주별로 작업 폼 바로가기 또는 설정 CTA를 다르게 노출한다.

### 4. 작업 탭

현재:

- 작업 목록만 있고 작업 생성은 대시보드 아래쪽에 있다.

개선:

- 장기적으로 작업 탭을 `작업 생성 + 작업 목록`으로 통합한다.
- 대시보드는 빠른 실행/최근 상태만 남긴다.
- 준비되지 않은 직원 작업은 폼 전체 disabled보다, 필요한 설정 항목을 먼저 보여준다.

### 5. 오류 보고

현재:

- 웹 오류 보고 폼이 단순하고 좋다.

개선:

- 전송 후 `접수됨`, `확인 중`, `수정됨`, `추가 정보 필요` 상태가 보이면 좋다.
- 지금 MVP에서는 report id 표시와 “자동 로그 포함” 안내만 보강한다.

## Visual Style

방향:

- 조용한 운영형 SaaS
- 밝은 배경 + 흰색 패널
- 과한 그라데이션/장식 배제
- 8px radius 유지
- 정보 밀도는 유지하되 상태/CTA hierarchy를 더 또렷하게

색:

- 현재 navy sidebar와 blue primary는 유지
- status 색은 green/amber/red 유지
- 직원별 색을 강하게 나누기보다 avatar/profile 이미지로 구분

타이포:

- 대시보드 숫자/상태는 더 크고 선명하게
- 설명 문장은 짧게
- 버튼/라벨 텍스트는 기능 중심

컴포넌트:

- `setup-step`: 설정 단계 행
- `next-action`: 대시보드 최상단 추천 행동
- `employee-status`: 직원별 readiness 표시
- `job-blocker`: 작업 차단 사유와 해결 버튼
- `report-status`: 오류 보고 상태

## 적용 순서

1. `static/app.html`에 `next-action` 영역 추가
2. 설정 탭을 readiness step layout으로 변경
3. 직원 상세에 필요한 설정/상태를 추가
4. 작업 폼 차단 UI를 job-blocker로 정리
5. 오류 보고 접수 안내 보강
6. 브라우저/모바일 시각 검증
7. Lazyweb MCP가 연결되면 실제 레퍼런스 검색 결과로 style brief 보강

## 비적용

- 랜딩페이지 스타일 hero
- 대형 마케팅 카드
- 네이버 PW/API Key 웹 입력
- Lazyweb 특정 앱 화면의 직접 복제
- 기능 검증 전 대규모 리디자인
