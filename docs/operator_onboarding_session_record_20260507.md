# AIMAX Operator And First-User Onboarding Session Record

작성일: 2026-05-07

## 한 줄 요약

AIMAX 운영자 페이지, 구매자 온보딩, 대량 등록, 첫 사용자 가이드, Oracle 배포 체계를 실제 운영 상태로 정리하고 배포했다.

## 현재 운영 구조

- 운영 웹앱: `https://api.aimax.ai.kr/app`
- 운영자 페이지: `https://api.aimax.ai.kr/admin`
- API 서버: Oracle 서버 `oracle-server`
- 앱 경로: `/home/ubuntu/aimax-reports-api`
- 다운로드 경로: `/home/ubuntu/aimax-downloads`
- 서비스: `aimax-reports-api.service`
- 배포 스크립트: `scripts/deploy_oracle.sh`

웹앱은 Vercel이 아니라 Oracle 서버의 Node 서비스와 Caddy reverse proxy로 운영한다.

## 핵심 결정

- 네이버 비밀번호와 Gemini/Claude/OpenAI API Key 원문은 웹앱 서버에 저장하지 않는다.
- 민감정보는 사용자 PC의 macOS Keychain 또는 Windows Credential Manager에 저장한다.
- 웹앱은 상태 확인, 작업 큐, 다운로드, 안내, 오류 보고를 담당한다.
- 로컬 실행기는 네이버 로그인, 브라우저 자동화, API Key 사용, 실제 자동화를 담당한다.
- 운영자 페이지는 `/admin` 브라우저 UI와 HTTP-only 관리자 세션 쿠키로 운영한다.
- 직접 관리자 API 운영은 `X-AIMAX-Admin-Token` fallback으로 유지한다.
- 운영 서버에는 전용 `AIMAX_ADMIN_PASSWORD`가 설정되어 있다. 실제 비밀번호 원문은 문서에 남기지 않는다.
- 초기 구매자 50명 운영을 위해 단건 등록과 대량 등록을 모두 지원한다.

## 운영자 페이지 완료 사항

- `/admin` 운영자 페이지 추가 및 운영 배포 완료
- 관리자 로그인 API 추가
  - `POST /api/admin/login`
  - `POST /api/admin/logout`
  - `GET /api/admin/me`
  - `GET /api/admin/catalog`
- 관리자 사용자 API
  - `POST /api/admin/users/provision`
  - `POST /api/admin/users/provision-batch`
  - `GET /api/admin/users`
- 관리자 세션은 HTTP-only cookie `aimax_admin_session`으로 유지한다.
- 관리자 페이지에서 구매자 이메일, 이름, 상품, 만료일, 운영 메모로 계정을 생성/갱신한다.
- 신규 구매자는 임시 비밀번호가 자동 생성된다.
- 임시 비밀번호는 생성 응답에서 한 번만 보여준다.
- 기존 구매자는 상품 변경과 비밀번호 재발급을 분리했다.

## 상품/권한 구조

| product | 열리는 직원 | 다운로드 | 가능한 작업 |
|---|---|---|---|
| `yeri` | 예리 | 예리 설치 파일 | `yeri_write` |
| `hyunju` | 현주 | 현주 설치 파일 | `hyunju_find` |
| `bundle` | 예리, 현주 | 통합 설치 파일 | `yeri_write`, `hyunju_find` |

비밀번호 변경 전이거나 권한 만료/비활성이면 `can_execute=false`가 되어 다운로드와 작업 실행이 제한된다.

## 대량 등록

관리자 페이지에 `여러 구매자 열기` UI를 추가했다.

입력 형식:

```text
buyer1@example.com, 홍길동
buyer2@example.com, 김민수
buyer3@example.com, 이예리, yeri
buyer4@example.com, 박현주, hyunju, 2026-06-30
```

각 줄의 순서:

```text
이메일, 이름, 상품, 만료일, 운영 메모
```

동작:

- 최대 100명까지 한 번에 처리한다.
- 상품을 비워두면 화면에서 선택한 기본 상품을 적용한다.
- `bundle`, `yeri`, `hyunju`, `통합`, `예리`, `현주`를 인식한다.
- 서버가 먼저 전체 입력을 검증한다.
- 잘못된 이메일, 잘못된 상품, 같은 목록 안의 중복 이메일이 있으면 저장하지 않고 오류 줄을 보여준다.
- 성공하면 이메일별 임시 비밀번호와 안내문을 한 번에 복사할 수 있다.

## 첫 사용자 API Key 입력 흐름

새 사용자는 웹앱에 API Key를 입력하지 않는다.

정상 흐름:

1. 웹앱 로그인
2. 첫 로그인 비밀번호 변경
3. 실행기 설치
4. 웹앱에서 `실행기 연결`
5. 웹앱에서 `로컬 설정 열기`
6. 사용자 PC의 `AIMAX 로컬 보안 설정` 창에서 네이버 ID/PW와 AI API Key 입력
7. 설정 저장
8. 웹앱에서 첫 테스트 작업 실행

모델별 필요한 키:

- Gemini 모델: Gemini API Key
- GPT 모델: OpenAI API Key
- Claude 모델: Claude API Key

이 값들은 웹앱 서버가 아니라 사용자 PC의 OS 안전 저장소에 저장된다.

## 첫 사용자 가이드

웹앱 대시보드에 `첫 사용자 가이드` 패널을 추가했다.

가이드는 현재 상태를 읽어 한 번에 하나의 다음 단계만 크게 보여준다.

순서:

1. 비밀번호 변경
2. 실행기 설치
3. 실행기 연결
4. 로컬 보안 설정
5. 웹 작업 설정
6. 첫 작업 테스트

가이드의 목적은 초보 사용자가 API Key 입력 위치를 찾지 못하고 막히는 일을 줄이는 것이다.

## Caddy 라우트

`api.aimax.ai.kr` Caddy 설정은 아래 경로를 `127.0.0.1:18988`로 프록시해야 한다.

- `/api/*`
- `/app*`
- `/admin*`
- `/assets/*`
- `/health`
- `/`

`/admin` 404가 발생해 `/admin*` 라우트를 추가했고, Caddy validate/reload 후 운영 확인을 완료했다.

## 배포 기록

주요 배포 리포트:

- `docs/deployments/oracle-deploy-20260506-204744.md`
  - `/admin` 운영자 페이지 배포
  - Caddy `/admin*` 라우트 추가
- `docs/deployments/oracle-deploy-20260507-100954.md`
  - 관리자 전용 비밀번호 설정 이후 대량 구매자 등록 API/UI 배포
- `docs/deployments/oracle-deploy-20260507-103055.md`
  - 첫 사용자 가이드 배포

## 검증 결과

로컬 검증:

- 관리자 로그인 쿠키 흐름 통과
- 단건 구매자 생성 통과
- 임시 비밀번호 로그인 후 `can_execute=false` 확인
- 비밀번호 변경 후 `can_execute=true` 확인
- 다운로드 권한 확인
- 대량 등록 invalid batch 차단 확인
- 대량 등록 2명 생성 및 관리자 목록 반영 확인
- `server.js` Node syntax check 통과
- `app.html`, `admin.html` inline JS syntax check 통과

운영 검증:

- `GET /health` -> 200
- `GET /app` -> 200
- `GET /admin` -> 200
- 미인증 `GET /api/admin/users` -> 401
- 잘못된 관리자 로그인 -> 401
- 설정된 관리자 비밀번호 로그인 -> 200, admin session cookie 발급
- 대량 등록 invalid batch -> 400 `invalid_batch`
- `/app`에 `첫 사용자 가이드` 문구 서빙 확인
- `/app`에 로컬 보안 설정/API Key 비저장 안내 서빙 확인
- 운영 `/app` inline JS parse check 통과

## 변경 파일

- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `oracle/aimax-reports-api/static/admin.html`
- `scripts/deploy_oracle.sh`
- `docs/admin_user_operations_guide.md`
- `docs/oracle_deployment_runbook.md`
- `docs/webapp_settings_ux_phase.md`
- `oracle/aimax-reports-api/README.md`
- `docs/deployments/oracle-deploy-20260506-204744.md`
- `docs/deployments/oracle-deploy-20260507-100954.md`
- `docs/deployments/oracle-deploy-20260507-103055.md`

## 다음 스텝

1. 실제 운영자 계정으로 구매자 1명을 생성하고 첫 로그인부터 첫 사용자 가이드까지 화면 기준으로 점검한다.
2. 초보 사용자 관점에서 첫 사용자 가이드 문구를 더 다듬는다.
3. Windows/macOS 실행기에서 `로컬 설정 열기`가 동일하게 보안 설정 창을 띄우는지 실제 환경에서 재확인한다.
4. 관리자 페이지 다음 보강 후보:
   - 사용자 일시정지/재활성화
   - 만료일 일괄 변경
   - 운영 메모 검색
   - 감사 로그
   - 비밀번호 재발급 안내문 자동 복사
5. 실제 첫 고객 온보딩 전, API Key 입력 위치와 모델별 필요한 키 안내를 한 번 더 점검한다.
