# AI 개발자 인수인계: AIMAX 직원 카탈로그/관리자 기반

작성일: 2026-05-11  
프로젝트: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management`

## 먼저 읽을 문서

1. `docs/ai_staff_integration_architecture_20260511.md`
2. `docs/ai_staff_admin_foundation_phase_20260511.md`
3. `docs/aimax_ai_staff_console_phase.md`
4. `docs/local_agent_transition_handoff.md`

## 목표

신규 직원 5명의 레포 기능을 바로 병합하지 말고, AIMAX에서 직원들을 운영 가능한 단위로 관리할 수 있는 기반을 만든다.

이번 작업의 완료 기준:
- 직원 목록이 데이터 기반 카탈로그에서 로드된다.
- 관리자 페이지에서 직원 상태/노출/정렬/설명을 수정할 수 있다.
- 사용자 화면은 실행 가능한 직원과 준비 중인 직원을 구분한다.
- 기존 예리/현주 작업 흐름은 깨지지 않는다.

## 신규 직원과 레포

| 직원 | 역할 | 레포 | HEAD |
| --- | --- | --- | --- |
| 나경 | 판서쌤 | `https://github.com/aixlife/pencil` | `9b02338f1be880297b0f1640dfde33186de71db0` |
| 현성 | PM | `https://github.com/makefamily/Project-manager` | `85a2cc5bcaa69728d06a6b00eb28e1366bae100d` |
| 상수 | 회계원 | `https://github.com/makefamily/bookkeeper` | `a61913b1546e28bb798c248a9ff084bb6c14425a` |
| 윤미 | 스크립트작가 | `https://github.com/makefamily/script-writer` | `29436b4de9cb38279de3f922dca1e7ccadfaa037` |
| 송이 | 자료조사원 | `https://github.com/makefamily/data-research` | `c79ddea94dbe92fd6a8edc8f436614870e1553d9` |

## 현재 반영된 상태

이미 사용자 화면에는 5명이 임시 등록되어 있다.

주요 파일:
- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `oracle/aimax-reports-api/static/assets/avatar_*.jpg`
- `scripts/deploy_oracle.sh`

최근 배포:
- `docs/deployments/oracle-deploy-20260511-143635.md`

운영 확인:
- `/api/workers`에서 기존 2명 + 신규 5명 조회됨
- 신규 직원 이미지는 서버에서 `GET /assets/avatar_*.jpg`로 접근 가능
- 신규 직원은 `needs_setup` 상태이며 실행 목록에서는 제외되어야 함

## 구현해야 할 것

### 1. 직원 카탈로그 데이터화

`server.js` 안의 하드코딩 배열을 바로 없애기보다, 먼저 기본 seed로 옮긴다.

권장:
- `DEFAULT_STAFF_CATALOG`
- `loadStaffCatalog()`
- `saveStaffCatalog()`
- 저장 위치: `DATA_DIR/staff-catalog.json`

기존 `/api/workers` 응답은 호환 유지한다.

### 2. 관리자 API

추가할 API:
- `GET /api/admin/staff`
- `GET /api/admin/staff/:code`
- `POST /api/admin/staff`
- `PATCH /api/admin/staff/:code`

주의:
- 기존 관리자 인증 방식을 반드시 사용한다.
- API 키, 환경 변수, 서버 실행 명령, 임의 파일 경로는 저장/수정 대상으로 허용하지 않는다.

### 3. 관리자 UI

`static/admin.html`에 직원 관리 섹션을 추가한다.

필수 기능:
- 직원 목록 조회
- 상태 변경
- 노출 여부 변경
- 정렬 순서 변경
- 설명/레포 URL/소스 커밋 수정
- 저장 실패 표시

이미지 업로드는 이번 범위 밖이다. 문자열 경로 수정만 허용해도 충분하다.

### 4. 사용자 화면 정리

`static/app.html`에서 직원 목록은 서버 카탈로그를 기준으로 렌더링한다.

중요:
- `needs_setup`, `planned` 직원은 카드에는 보인다.
- 실행 버튼/작업 선택에는 나오면 안 된다.
- 예리/현주 기존 작업은 그대로 동작해야 한다.

## 하지 말 것

- 신규 5개 레포를 통째로 AIMAX에 복사하지 말 것.
- 유료 AI 호출 테스트를 하지 말 것.
- Supabase 의존성을 AIMAX에 바로 추가하지 말 것.
- 나경 Electron 앱 빌드나 배포를 이번 작업에 섞지 말 것.
- 기존 로컬 에이전트 프로토콜을 임의로 바꾸지 말 것.
- 배포는 사용자 요청 또는 명시 승인 전에는 하지 말 것.

## 검증 명령

최소 검증:

```bash
node --check oracle/aimax-reports-api/server.js
```

추가 검증:
- `app.html` inline script 문법 확인
- `admin.html` inline script 문법 확인
- 로컬 서버에서 `/api/workers` 확인
- 비관리자 요청이 `/api/admin/staff`에 접근하지 못하는지 확인
- 관리자 PATCH 후 `/api/workers`에 반영되는지 확인

## 다음 기능화 우선순위

1. 윤미: 스크립트 생성 AI 직원
2. 송이: 자료조사/레퍼런스 보드
3. 현성: PM/운영 관리
4. 상수: 회계 대시보드
5. 나경: 로컬 판서 앱 연결

이 순서는 기능 완성도, AIMAX와의 결합 난이도, 운영 위험을 기준으로 정했다.

## 완료 보고에 포함할 내용

- 변경 파일
- 카탈로그 저장 위치
- 관리자에서 수정 가능한 필드
- `/api/workers` 호환 여부
- 실행한 검증
- 배포 여부
- 남은 위험과 다음 단계
