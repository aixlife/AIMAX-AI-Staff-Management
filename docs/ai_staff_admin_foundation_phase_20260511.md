# AIMAX 직원 관리자 기반 구현 단계

작성일: 2026-05-11  
대상: AI 개발자가 바로 구현할 수 있는 작업 지시서

## 1. 목적

신규 직원 5명을 기능 없이 임시 노출한 현재 상태를 기반으로, 앞으로 관리자 페이지에서 직원들을 관리하고 각 직원 레포의 기능을 순차적으로 붙일 수 있는 바탕을 만든다.

이번 단계의 핵심은 기능 구현이 아니라 다음 세 가지다.

1. 직원 카탈로그를 코드 하드코딩에서 데이터 기반으로 옮긴다.
2. 관리자 페이지에서 직원 상태와 노출을 관리한다.
3. 추후 직원별 기능이 공통 작업 계약으로 들어올 수 있게 필드를 준비한다.

## 2. 현재 관련 파일

서비스 서버:
- `oracle/aimax-reports-api/server.js`

사용자 웹:
- `oracle/aimax-reports-api/static/app.html`

관리자 웹:
- `oracle/aimax-reports-api/static/admin.html`

정적 자산:
- `oracle/aimax-reports-api/static/assets/avatar_nakyung.jpg`
- `oracle/aimax-reports-api/static/assets/avatar_hyunseong.jpg`
- `oracle/aimax-reports-api/static/assets/avatar_sangsu.jpg`
- `oracle/aimax-reports-api/static/assets/avatar_yunmi.jpg`
- `oracle/aimax-reports-api/static/assets/avatar_songi.jpg`

배포:
- `scripts/deploy_oracle.sh`

최근 배포 기록:
- `docs/deployments/oracle-deploy-20260511-143635.md`

## 3. 구현 범위

이번 구현에 포함:
- `staff-catalog.json` 기반 카탈로그 로딩
- 기존 `WORKERS` 배열과 호환되는 public 변환 유지
- 관리자 직원 조회/수정 API
- 관리자 페이지 직원 관리 UI
- 사용자 화면이 카탈로그 변경을 따라가도록 정리

이번 구현에 제외:
- 5개 레포 기능 병합
- 유료 AI 호출
- Supabase 의존성 추가
- 나경 Electron 앱 빌드/배포
- 예리/현주 로컬 에이전트 동작 변경

## 4. 권장 데이터 파일

기본 위치:

```text
DATA_DIR/staff-catalog.json
```

`DATA_DIR`는 현재 서버가 쓰는 데이터 디렉터리 규칙을 따른다. 없으면 기존 서비스의 report/job 저장 위치와 같은 계층에 둔다.

권장 구조:

```json
{
  "version": 1,
  "updated_at": "2026-05-11T00:00:00.000Z",
  "staff": []
}
```

직원 객체 필수 필드:

```json
{
  "code": "songi_data_research",
  "staff_code": "songi",
  "name": "송이",
  "role": "자료조사원",
  "title": "트렌드 자료조사",
  "description": "레퍼런스와 자료를 모아 콘텐츠 기획에 쓸 수 있게 정리합니다.",
  "category": "research",
  "product": "bundle",
  "status": "needs_setup",
  "visibility": "visible",
  "sort_order": 70,
  "integration_type": "web_module",
  "module_key": "data_research",
  "job_kind": "",
  "execution": {
    "type": "planned",
    "runner": null
  },
  "required_settings": ["future_staff_setup"],
  "settings": ["future_staff_setup"],
  "profile_image": "/assets/avatar_songi.jpg",
  "avatar": "/assets/avatar_songi.jpg",
  "repo_url": "https://github.com/makefamily/data-research",
  "source_commit": "c79ddea94dbe92fd6a8edc8f436614870e1553d9",
  "capabilities": [],
  "admin_notes": "",
  "created_at": "2026-05-11T00:00:00.000Z",
  "updated_at": "2026-05-11T00:00:00.000Z"
}
```

주의:
- 기존 프론트 호환을 위해 `settings`와 `avatar`는 당분간 유지한다.
- 새 코드에서는 `required_settings`, `profile_image`를 기준 필드로 사용한다.

## 5. Phase 1: 서버 카탈로그 분리

목적:
- `server.js`의 직원 목록을 파일 기반으로 이동한다.

작업:
- `DEFAULT_STAFF_CATALOG`를 만든다.
- `staffCatalogPath()`를 만든다.
- `loadStaffCatalog()`를 만든다.
- `saveStaffCatalog(catalog)`를 만든다.
- 파일이 없으면 기본 카탈로그를 생성한다.
- 파일이 깨져 있으면 서버가 죽지 않게 기본값으로 복구하되, 오류를 로그에 남긴다.
- `publicWorker(worker)`는 기존 응답 필드와 새 필드를 함께 지원한다.

수용 기준:
- `GET /api/workers` 응답 구조가 기존 프론트와 호환된다.
- 서버 재시작 후 `staff-catalog.json` 수정 내용이 유지된다.
- 신규 5명은 계속 `needs_setup`으로 보인다.
- 예리/현주는 기존 실행 흐름이 깨지지 않는다.

## 6. Phase 2: 관리자 API

목적:
- 관리자 페이지가 직원 목록을 조회하고 수정할 수 있게 한다.

권장 엔드포인트:

```text
GET    /api/admin/staff
GET    /api/admin/staff/:code
PATCH  /api/admin/staff/:code
POST   /api/admin/staff
```

`PATCH` 허용 필드:
- `name`
- `role`
- `title`
- `description`
- `category`
- `product`
- `status`
- `visibility`
- `sort_order`
- `integration_type`
- `module_key`
- `job_kind`
- `required_settings`
- `profile_image`
- `repo_url`
- `source_commit`
- `admin_notes`

막아야 할 필드:
- 임의의 서버 실행 명령
- 환경 변수
- API 키
- 파일 시스템 경로
- 인증 관련 내부 값

수용 기준:
- 관리자 인증 없이는 접근할 수 없다.
- 잘못된 `status`, `visibility`, `integration_type` 값은 거부된다.
- 수정 후 `/api/workers`에 반영된다.
- 수정 시 `updated_at`이 갱신된다.

## 7. Phase 3: 관리자 UI

목적:
- 운영자가 코드 수정 없이 직원 상태를 바꿀 수 있게 한다.

관리자 페이지에 추가할 섹션:
- 직원 관리

필수 UI:
- 직원 목록 테이블
- 검색/상태 필터
- 직원 상세 편집 패널
- 상태 변경 셀렉트
- 노출 여부 셀렉트
- 정렬 순서 입력
- 레포 URL/소스 커밋 표시
- 필수 설정 목록 표시

첫 버전에서 이미지 업로드는 하지 않아도 된다. 대신 `profile_image` 문자열 수정은 가능하게 한다.

수용 기준:
- 관리자 페이지에서 송이를 `hidden`으로 바꾸면 사용자 화면에서 사라진다.
- 다시 `visible`로 바꾸면 사용자 화면에 나타난다.
- `sort_order` 변경 후 사용자 화면 직원 순서가 바뀐다.
- 관리자 UI 저장 실패 시 사용자에게 오류를 보여준다.

## 8. Phase 4: 사용자 화면 정리

목적:
- 사용자 화면이 서버 카탈로그를 단일 진실로 사용하게 한다.

작업:
- `app.html`의 fallback 직원 목록은 서버 장애용 최소값으로만 둔다.
- 직원 렌더링은 `/api/workers` 결과를 기준으로 한다.
- 실행 가능 직원 필터를 명확히 분리한다.

권장 실행 가능 조건:

```js
function isRunnableWorker(worker) {
  return worker.status === "available" &&
    worker.execution?.type !== "planned" &&
    Boolean(worker.jobKind || worker.job_kind);
}
```

수용 기준:
- `needs_setup` 직원은 카드에는 보인다.
- `needs_setup` 직원은 빠른 실행/작업 선택에는 나오지 않는다.
- 기존 예리/현주 작업 선택은 유지된다.

## 9. Phase 5: 공통 작업 계약 준비

목적:
- 나중에 윤미, 송이, 현성, 상수 기능을 같은 방식으로 붙일 수 있게 한다.

이번 단계에서는 실제 실행기는 만들지 않아도 된다. 단, 타입과 에러 응답을 준비한다.

권장 엔드포인트:

```text
POST /api/staff-jobs
GET  /api/staff-jobs/:id
GET  /api/admin/staff/:code/jobs
```

실행기가 없는 직원 응답:

```json
{
  "ok": false,
  "error": "staff_not_ready",
  "message": "이 직원은 아직 설정이 필요합니다.",
  "staff_code": "yunmi"
}
```

수용 기준:
- 실행기가 없는 직원 요청은 500이 아니라 명확한 409 또는 422로 응답한다.
- 기존 `/api/jobs` 흐름은 바뀌지 않는다.

## 10. 검증 체크리스트

로컬 정적 검증:

```bash
node --check oracle/aimax-reports-api/server.js
```

HTML 스크립트 검증:
- `app.html`의 inline script가 문법 오류 없이 파싱되어야 한다.
- `admin.html`의 inline script가 문법 오류 없이 파싱되어야 한다.

API 검증:

```bash
curl -sS http://127.0.0.1:3001/api/workers
```

관리자 API 검증:
- 비로그인 요청은 401 또는 기존 관리자 인증 정책에 맞는 거부 응답
- 로그인/관리자 토큰 요청은 직원 목록 반환
- PATCH 후 `/api/workers` 반영

배포 전 검증:
- 신규 파일이 `scripts/deploy_oracle.sh web`에 포함되는지 확인
- 이미지 자산이 배포 대상에 포함되는지 확인

## 11. 회귀 위험

주의할 부분:
- `/api/workers` 응답 필드명을 급하게 바꾸면 사용자 화면이 깨질 수 있다.
- 관리자 API에 과도한 필드 수정을 허용하면 보안 문제가 생긴다.
- 준비 중 직원을 실행 목록에 넣으면 사용자가 실패 작업을 만들게 된다.
- 파일 저장 방식은 동시 수정 충돌 가능성이 있으므로, 장기적으로 DB 또는 잠금 처리가 필요하다.

## 12. 구현 순서 요약

1. 현재 `WORKERS` 데이터를 `DEFAULT_STAFF_CATALOG`로 정리한다.
2. `staff-catalog.json` 로드/저장 함수를 만든다.
3. `/api/workers`가 파일 기반 카탈로그를 사용하게 한다.
4. 관리자 staff API를 추가한다.
5. `admin.html`에 직원 관리 UI를 추가한다.
6. `app.html` 실행 가능 직원 필터를 정리한다.
7. 정적 검증과 API 검증을 수행한다.
8. 사용자 승인 후 배포한다.

