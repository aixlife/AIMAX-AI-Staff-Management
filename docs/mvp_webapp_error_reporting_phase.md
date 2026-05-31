# AIMAX MVP Phase: 웹앱 전환 및 오류 보고

작성일: 2026-05-04

## MVP 목표

지금 구매한 사용자가 "프로그램을 켜는 느낌"이 아니라 "웹앱에 로그인해서 사용하는 느낌"을 갖도록 만든다. 동시에 오류가 카톡, 채널톡, 단톡방에 흩어지지 않고 앱 내부 오류 보고 버튼으로 Oracle 서버에 모이도록 한다.

이번 MVP의 중심은 기능 추가가 아니라 다음 3가지다.

1. 웹앱 사용 흐름
2. 오류 보고 자동 수집
3. 구매자/회원 계정 빠른 개통

## MVP에서 하지 않는 것

- 완전 무설치 SaaS
- 서버에서 네이버 자동화 실행
- 결제 자동 연동
- 외부 다중 AI 모델 기능
- 모든 기능의 UI 전면 재설계
- 모든 회원 인증 자동화
- 강제 무음 자동 업데이트

## 전체 구조

```text
사용자 브라우저
  AIMAX Web
      |
      | 로그인 / 작업 생성 / 오류 보고
      v
Oracle 서버
  auth / users / entitlements / reports / jobs
      ^
      | polling / report upload / version check
      |
사용자 PC
  AIMAX Local Agent
      |
      v
로컬 Chrome / 네이버 블로그 자동화
```

## Phase 0. 문서 및 결정 고정

목적: 작업 순서가 흔들리지 않도록 MVP 범위를 고정한다.

범위:

- 장기 업데이트 로드맵 작성
- 현재 MVP Phase 문서 작성
- Oracle 연결 기준 기록
- 보안 원칙 기록

완료 기준:

- `docs/aimax_update_roadmap.md`
- `docs/mvp_webapp_error_reporting_phase.md`

## Phase 1. 현재 앱 오류 보고 기능

목적: 웹앱 전환 전에도 기존 앱에서 오류를 한 번에 수집할 수 있게 한다.

범위:

- 앱 내부 "오류 보고" 버튼 추가
- 오류 보고 다이얼로그 추가
- 사용자 입력:
  - 어떤 작업 중이었는지
  - 보이는 오류 메시지
  - 추가 설명
- 자동 수집:
  - 프로그램명
  - 앱 버전
  - OS
  - Python 버전
  - frozen 여부
  - 앱 데이터 경로
  - 라이선스 ID 또는 익명 설치 ID
  - 최근 콘솔 로그
  - 최근 traceback
  - 최근 debug 파일 목록
  - 가능하면 Chrome/Selenium 상태
- 민감정보 마스킹
- 서버 URL이 없어도 로컬 JSON 저장
- 서버 전송 실패 시 pending 저장

수정 대상:

- `paths.py`
- `utils/logger.py`
- `app.py`
- 신규 `diagnostics/__init__.py`
- 신규 `diagnostics/redaction.py`
- 신규 `diagnostics/system_info.py`
- 신규 `diagnostics/error_reporter.py`

최소 침습 원칙:

- `app.py`에는 버튼, 다이얼로그, 호출부만 둔다.
- 수집, 마스킹, 저장, 전송은 `diagnostics/` 모듈이 담당한다.
- 기존 자동화 워커 로직은 건드리지 않는다.

검증:

- 서버 없이 오류 보고 시 로컬 JSON 저장
- 서버 전송 실패 시 pending 저장
- 네이버 ID/PW/API Key/쿠키/토큰 마스킹
- debug 파일 내용이 아니라 목록만 포함
- macOS dev 실행에서 정상 동작
- Windows 동일 구조 이식 가능성 확인

## Phase 2. Oracle 오류 보고 API

목적: 사용자 오류 보고가 민수에게 자동으로 모이게 한다.

Oracle 참고:

- SSH: `ssh -p 3333 ubuntu@100.69.85.89`
- 참고 문서: `/Users/aixlife/.claude/memory/reference_oracle_personal_assistant.md`

범위:

- `POST /api/reports`
- report id 발급
- JSON 저장
- 관리자 알림
- 상태값 관리:
  - `new`
  - `checking`
  - `fixed`
  - `need_user_info`
- 서버에서도 2차 마스킹

검증:

- 앱에서 report 전송
- 서버에 report 저장
- 민감정보가 저장 전 마스킹
- 서버 장애 시 앱에 pending 저장
- pending 재전송 시 중복 report 방지

진행 상태:

- Oracle 내부 서비스 구현 완료
  - 서비스 경로: `/home/ubuntu/aimax-reports-api`
  - 저장 경로: `/home/ubuntu/aimax-reports/data/reports/YYYY-MM-DD/`
  - 내부 포트: `127.0.0.1:18988`
  - systemd user service: `aimax-reports-api`
- 서버 내부 검증 완료
  - `GET /api/reports/health` 정상
  - 토큰 없는 `POST /api/reports`는 `401 unauthorized`
  - 토큰 있는 `POST /api/reports`는 `201 created`
  - 서버 저장 전 2차 마스킹 정상
- 공개 라우팅 정정
  - `sosu-budget.camdvr.org`는 Oracle 서버에 이미 있던 기존 Caddy site 이름일 뿐, AIMAX 오류 보고용 도메인으로 확정된 값이 아니다.
  - AIMAX 오류 보고 API는 `api.aimax.ai.kr` 서브도메인으로 연결한다.
  - 오류 보고 endpoint: `https://api.aimax.ai.kr/api/reports`
  - Caddy에는 `api.aimax.ai.kr` 전용 route를 추가했고, `sosu-budget.camdvr.org`의 임시 `/api/reports` route는 제거했다.
- DNS 상태
  - 호스팅케이알 authoritative DNS: `api.aimax.ai.kr -> 213.35.100.96`
  - Google DNS: `api.aimax.ai.kr -> 213.35.100.96`
  - 일부 resolver는 아직 미전파 상태일 수 있다.
- 외부 공개 전 점검 사항
  - 같은 공인 IP에서 SSH `3333`은 외부 접근 가능
  - 서버 OS nft/iptables INPUT 체인에서 `3333`, `5678`, `18789`, `22` 등 일부 포트만 허용하고 마지막에 reject 처리하는 상태 확인
- 외부 공개 완료
  - 사용자 승인 후 서버 OS 방화벽에서 `80/443` 허용 및 `netfilter-persistent save` 완료
  - Caddy가 `api.aimax.ai.kr` Let's Encrypt 인증서 발급 완료
  - 공개 health check 정상: `https://api.aimax.ai.kr/api/reports/health`
  - 로컬 앱 진단 모듈에서 공개 endpoint로 POST 성공
  - 테스트 report id: `AIMAX-RPT-20260504231652-cd5df7db`

## Phase 3. 구매자/회원 계정 빠른 개통

목적: 기존 구매자와 회원이 웹앱에 빠르게 들어오게 한다.

구매자 흐름:

1. 구매자 이메일을 사용자 계정으로 등록
2. 상품 권한 지정: `yeri`, `hyunju`, `bundle`
3. 랜덤 임시 비밀번호 또는 1회용 초대 링크 발송
4. 첫 로그인 시 비밀번호 변경 강제
5. 변경 전에는 작업 실행 불가

회원 흐름:

1. 일정 기간 회원가입 오픈
2. 이메일 인증
3. 회원 베타 권한 자동 부여 또는 관리자 승인
4. 이후 회원 인증 자동화로 전환

보안 기준:

- 초기 비밀번호를 이메일 기반으로 예측 가능하게 만들지 않는다.
- 비밀번호 원문은 저장하지 않는다.
- 첫 로그인 비밀번호 변경 여부를 서버에서 추적한다.
- 구매 권한 없는 계정은 웹 로그인은 가능해도 작업 실행은 불가하다.
- 관리자 API는 `AIMAX_ADMIN_TOKEN`으로 보호한다.
- 세션 토큰은 원문 저장하지 않고 SHA-256 해시로만 저장한다.

검증:

- 구매자 이메일로 로그인 가능
- 첫 로그인 팝업 표시
- 비밀번호 변경 전 작업 실행 불가
- 권한별 메뉴 표시
- 권한 회수 시 다음 실행부터 잠김

진행 상태:

- Oracle AIMAX API에 계정/권한 MVP 구현 완료
  - 사용자 저장: `/home/ubuntu/aimax-reports/data/users.json`
  - 세션 저장: `/home/ubuntu/aimax-reports/data/sessions.json`
  - 비밀번호 저장: `scrypt` 해시
  - 세션 저장: 토큰 원문 대신 SHA-256 해시
- 관리자 개통 API
  - `POST https://api.aimax.ai.kr/api/admin/users/provision`
  - 입력: 이메일, 이름, 상품 권한 `yeri` / `hyunju` / `bundle`, source
  - 출력: 임시 비밀번호는 생성 시 1회만 응답
- 로그인 API
  - `POST https://api.aimax.ai.kr/api/auth/login`
  - 첫 로그인 시 `requires_password_change: true`
  - 비밀번호 변경 전 `can_execute: false`
- 비밀번호 변경 API
  - `POST https://api.aimax.ai.kr/api/auth/change-password`
  - 변경 완료 후 `requires_password_change: false`, `can_execute: true`
- 내 계정 확인 API
  - `GET https://api.aimax.ai.kr/api/auth/me`
- 관리자 검색 API
  - `GET https://api.aimax.ai.kr/api/admin/users?query=<email>`
- 공개 HTTPS 검증 완료
  - 무인증 관리자 API는 `401`
  - 구매자 provision은 `201`
  - 임시 비밀번호 로그인은 성공하되 실행 불가
  - 비밀번호 변경 후 실행 가능
  - 테스트 계정은 검증 후 제거 완료

## Phase 4. 웹앱 사용 흐름 MVP

목적: 기존 구매자가 프로그램이 아니라 웹앱에서 작업을 시작하게 한다.

범위:

- 웹 로그인
- 권한별 메뉴 노출
- 로컬 실행기 연결 상태 표시
- 작업 시작 버튼
- 작업 진행 로그 표시
- 오류 보고 버튼 노출
- 기존 기능 중 최소 핵심 기능만 우선 연결

우선 연결 후보:

- 예리: 글쓰기 또는 고객 찾기 중 1개
- 현주: 현재 분리 버전에서 가장 안정적인 핵심 작업 1개
- 통합: 예리/현주 진입 링크와 실행기 상태 확인

구현 방향:

- 웹앱이 작업을 Oracle 서버에 생성한다.
- 로컬 Agent가 서버를 polling한다.
- Agent가 사용자의 PC에서 기존 Python 자동화 로직을 실행한다.
- 실행 로그와 상태를 서버로 보낸다.
- 웹앱은 상태와 로그를 보여준다.

검증:

- 웹에서 작업 생성
- Agent가 작업 수신
- 로컬 Chrome으로 네이버 작업 실행
- 로그가 웹에 표시
- 오류 발생 시 웹/Agent에서 오류 보고 가능

진행 상태:

- MVP 웹앱 공개 완료
  - URL: `https://api.aimax.ai.kr/app`
  - 루트 `https://api.aimax.ai.kr/`는 `/app`으로 이동
  - 현재는 API 도메인 아래 임시 웹앱으로 운영하고, 추후 `app.aimax.ai.kr` 등으로 분리 가능
- 웹앱 기능
  - 로그인
  - 첫 로그인 비밀번호 변경
  - 계정/상품 권한 표시
  - 로컬 실행기 연결 상태 표시
  - 권한별 빠른 작업 버튼
  - 작업 목록
  - 웹 오류 보고
- 작업 API
  - `POST /api/jobs`
  - `GET /api/jobs`
  - 비밀번호 변경 전 작업 생성 차단
  - 권한 없는 작업 생성 차단
  - 작업별 담당 직원 코드 저장
  - 현재 담당 직원: `yeri_writer`, `hyunju_sales`
  - 현재 MVP의 두 담당 직원은 네이버 자동화가 필요하므로 사용자 PC 로컬 Agent가 실행한다.
  - 추후 직원은 성격에 따라 로컬, 서버, 외부 AI 보조 역할로 나눌 수 있다.
- Agent API
  - `GET /api/agent/status`
  - `POST /api/agent/heartbeat`
  - `GET /api/agent/next-job`
  - `POST /api/agent/jobs/update`
- 업데이트 API
  - `GET /api/version?current=<version>`
  - Agent 현재 버전과 서버 최신/최소 버전 비교
  - 웹앱에서 업데이트 필요 상태 표시 가능
  - 사용자 PC 로컬 실행기 업데이트 안내용이다.
- 공개 HTTPS 검증 완료
  - `/app` HTML 응답 정상
  - 첫 로그인 상태에서 작업 생성 `403`
  - 비밀번호 변경 후 작업 생성 성공
  - Agent heartbeat 후 연결 상태 표시 가능
  - Agent next-job polling 가능
  - 작업 상태 update 가능
  - 로그인 세션 기반 웹 오류 보고 가능
  - 테스트 계정/작업/Agent/report는 검증 후 제거 완료

남은 범위:

- 실제 로컬 Agent가 Python 자동화 로직을 실행하도록 연결
- 웹앱에서 실제 작업 입력값을 받는 화면 확장
- `app.aimax.ai.kr` 분리 여부 결정

## Phase 5. 업데이트 체계 MVP

목적: 기능 업데이트나 오류 수정이 있을 때 사용자가 무엇을 해야 하는지 명확하게 만든다.

구분:

- 웹앱 업데이트: 사용자는 아무것도 하지 않는다.
- 로컬 Agent 업데이트: 사용자 PC의 실행기 업데이트가 필요하다.

MVP 방식:

1. Agent 시작 시 서버의 latest version 확인
2. 현재 버전이 낮으면 업데이트 안내 표시
3. 사용자가 "업데이트" 클릭
4. 설치 파일 다운로드
5. 설치 후 Agent 재시작
6. 웹앱에서 "최신 버전 연결됨" 표시

추후 방식:

- 코드서명된 자동 업데이트
- 필수 업데이트와 선택 업데이트 분리
- 네이버 셀렉터/프롬프트/정책값은 서버 설정으로 내려받아 재설치 없이 수정

검증:

- 낮은 버전 Agent 연결 시 업데이트 안내
- 최신 버전 Agent는 안내 없음
- 업데이트 후 기존 로그인/기기 등록 유지
- 업데이트 실패 시 오류 보고 가능

진행 상태:

- 서버 버전 체크 API 구현
  - `GET https://api.aimax.ai.kr/api/version?current=<version>`
  - 응답: `latest_version`, `min_version`, `update_available`, `update_required`, `download_url`, `release_notes`
- Agent heartbeat 응답에 `version_info` 포함
- 웹앱 로컬 실행기 카드에서 업데이트 필요 상태 표시
- OS별 다운로드 API 구현
  - `GET https://api.aimax.ai.kr/api/downloads/options`
  - `GET https://api.aimax.ai.kr/api/downloads/agent?platform=macos&product=bundle`
  - `GET https://api.aimax.ai.kr/api/downloads/agent?platform=windows&product=bundle`
  - 로그인 세션 필요
  - 권한 없는 상품 파일 다운로드 차단
- 웹앱에서 사용자 브라우저 환경 감지
  - macOS 감지 시 macOS DMG 설치파일 다운로드
  - Windows 감지 시 Windows EXE 설치파일 다운로드
  - 브라우저 보안상 자동 실행은 하지 않고, 사용자가 다운로드 파일을 열어 실행한다.
- 운영 서버 설치파일 업로드 대상
  - `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`
  - `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
  - `/home/ubuntu/aimax-downloads/aimax-yeri-macos.dmg`
  - `/home/ubuntu/aimax-downloads/aimax-yeri-windows.exe`
  - `/home/ubuntu/aimax-downloads/aimax-hyunju-macos.dmg`
  - `/home/ubuntu/aimax-downloads/aimax-hyunju-windows.exe`
- 운영 공개 API 검증 완료
  - `current=v0.9.0`일 때 `update_required: true`
  - 현재 운영 latest/min version: `v1.0.0`
  - 로그인 세션 기반 다운로드 옵션 6개 확인
  - macOS 통합 DMG 다운로드 응답 `200`
- 실행기 내부 Agent polling 구현
  - `web_agent/client.py` 추가
  - 로컬 앱 설정 화면에 "웹앱 연결" 카드 추가
  - 웹앱 이메일/비밀번호 로그인
  - 세션 토큰은 OS keyring에 저장
  - 앱 재시작 시 저장된 세션 복원
  - `/api/agent/heartbeat`로 로컬 실행기 상태 전송
  - `/api/agent/next-job`으로 웹앱 작업 수신
  - `/api/agent/jobs/update`로 running/done/failed/cancelled 상태 반영
  - `yeri_write`, `hyunju_find` 작업 payload를 기존 로컬 워커로 넘기는 연결부 추가
  - payload가 부족하면 실제 네이버 작업을 실행하지 않고 서버에 실패 사유를 남김
- 서버 Agent job payload 수신 버그 수정
  - `/api/jobs` 목록 응답은 기존처럼 payload를 숨김
  - `/api/agent/next-job` 응답에만 실행에 필요한 redacted payload를 포함
  - 이 수정 없이는 로컬 실행기가 키워드/멘트를 받지 못해 작업이 실패함
- 웹앱 작업 입력 폼 구현
  - 예리: 키워드, 발행 방식, 분량, 카테고리, CTA, 예약 날짜/시간
  - 현주: 검색 키워드, 키워드당 신청 수, 속도, 신청 멘트
  - 계정 상품 권한에 따라 사용할 수 없는 직원 폼은 비활성화
  - 생성된 job payload를 로컬 Agent가 받아 기존 worker로 실행 가능
- 웹앱 직원 프로필 UI 추가
  - 기존 예리/현주 프로필 이미지를 `/assets/...` 정적 경로로 서빙
  - 대시보드에서 직원 카드를 클릭하면 선택한 직원의 사진, 역할, 담당 흐름, 계정 권한 상태를 확인 가능
- v1.0.1 macOS 실행기 재빌드 및 운영 업로드
  - `aimax-bundle-macos.dmg`
  - `aimax-yeri-macos.dmg`
  - `aimax-hyunju-macos.dmg`
  - 세 DMG 모두 web-login/agent-polling 포함 빌드에서 생성
  - 세 DMG 모두 `hdiutil verify` 통과
  - 운영 서버 `/home/ubuntu/aimax-downloads` 업로드 완료
  - 서버 latest/min version을 `v1.0.1`로 변경
- Windows v1.0.0 ZIP은 혼선을 막기 위해 서버에서 `archive-old-v1.0.0`로 이동
  - Windows 다운로드는 새 Windows 빌드를 만들 때까지 준비 중 상태로 둔다.
- macOS E2E smoke test 통과
  - 실제 운영 API, 실제 로그인/비밀번호 변경, 실제 job 생성/수신/상태 업데이트 경로 확인
  - 네이버 로그인/발행/서로이웃 실행 함수는 테스트 더미로 대체해 안전하게 검증
  - `yeri_write`는 `mode=save`, 키워드, CTA, 카테고리, 분량이 기존 글쓰기 worker 인자로 전달됨
  - `hyunju_find`는 키워드, 신청 수, 신청 멘트, 속도가 기존 서로이웃 worker 인자로 전달됨
  - E2E용 임시 계정과 job/session/agent 기록은 검증 후 서버에서 삭제함

설치 파일 형식 결정:

- ZIP은 웹앱 연결 구조 검증용 임시 배포 형식으로만 사용한다.
- 사용자 경험 기준의 배포 형식은 OS별 설치/실행 파일이다.
  - macOS: 코드서명된 `.dmg` 또는 `.pkg`
  - Windows: 코드서명된 `.exe` 설치 파일 또는 `.msi`
- 브라우저 보안 정책상 웹앱이 파일을 자동 실행할 수는 없다.
  - 최적 흐름: 웹앱 로그인 → 내 OS 감지 → 설치 파일 다운로드 → 사용자가 열어 설치/실행
- 서버 다운로드 API는 DMG/EXE 설치파일 기준으로 전환한다.

남은 범위:

- 새 Agent 코드가 들어간 Windows EXE 설치파일 재빌드
- 코드서명/보안 경고 최소화
- 설치 파일 실행 안내 문구 보강
- 실제 네이버 작업을 돌리지 않는 범위에서 웹앱 job 생성 → 로컬 Agent 수신 → 상태 반영 smoke test

## Phase 6. 관리자 운영 화면

목적: 관리자가 구매자, 회원, 오류를 한 곳에서 처리한다.

범위:

- 사용자 검색
- 권한 부여/회수
- 기기 등록/해제
- 첫 로그인 비밀번호 변경 상태 확인
- 오류 보고 목록
- 오류 상태 변경
- 사용자에게 추가 정보 요청

검증:

- 관리자 권한 사용자만 접근 가능
- 일반 사용자는 관리자 API 접근 불가
- 권한 변경이 즉시 작업 실행에 반영

## 작업 순서

1. Phase 1: 현재 앱 오류 보고 기능
2. Phase 2: Oracle `/api/reports`
3. Phase 3: 구매자/회원 계정 빠른 개통
4. Phase 4: 웹앱 사용 흐름 MVP
5. Phase 5: 업데이트 체계 MVP
6. Phase 6: 관리자 운영 화면

## 첫 구현 시 체크리스트

- [x] `paths.py`에 report 디렉토리 추가
- [x] 파일 로그 저장 구조 추가
- [x] 민감정보 마스킹 모듈 추가
- [x] 오류 보고 payload 생성 모듈 추가
- [x] 앱 하단 Console에 오류 보고 버튼 추가
- [x] 오류 보고 다이얼로그 추가
- [x] 로컬 JSON 저장 테스트
- [x] pending 저장 테스트
- [x] Oracle `/api/reports` 수신 서버 구현
- [x] Oracle 내부 인증/마스킹/저장 테스트
- [x] AIMAX 전용 오류 보고 도메인/경로 확정
- [x] `api.aimax.ai.kr` Caddy route 구성
- [x] 확정 도메인으로 공개 HTTPS `/api/reports` 외부 접근 오픈
- [x] 앱에서 Oracle 서버로 POST 테스트
- [x] 구매자 이메일 기반 계정 생성 흐름 설계
- [x] 첫 로그인 비밀번호 변경 강제 흐름 설계
- [x] Phase 3 Auth API 서버 구현
- [x] Phase 3 공개 HTTPS API 검증
- [x] 웹앱/Agent 연결 방식 구현
- [x] Phase 4 웹앱 공개 URL 배포
- [x] Phase 4 작업/Agent API 공개 HTTPS 검증
- [x] 업데이트 버전 체크 API 구현
- [x] 웹앱 업데이트 필요 표시 구현
- [x] 실행기 업데이트 다운로드 흐름 구현
- [x] 실행기 내부 Agent polling 구현
- [x] 웹앱 작업 입력 폼 확장
- [x] 새 Agent 코드 포함 macOS 빌드 재생성
- [x] macOS 웹앱 job → 로컬 Agent dispatch E2E smoke test
- [x] ZIP 임시 배포를 macOS DMG 설치파일로 전환
- [ ] 새 Agent 코드 포함 Windows EXE 설치파일 재생성

## 사용자 안내 문구 초안

오류 보고 다이얼로그:

> 오류 해결을 위해 앱 버전, OS 정보, 로컬 라이선스 ID 또는 익명 설치 ID, 최근 실행 로그, traceback, 최근 debug 파일 목록, 브라우저/Selenium 상태가 메이크패밀리 서버로 전송될 수 있습니다. 네이버 비밀번호, API Key, 쿠키/세션 등 민감정보는 자동 마스킹되며 원문은 전송하지 않습니다. 사용자가 입력한 오류 설명은 그대로 전송됩니다.

첫 로그인 비밀번호 변경:

> 보안을 위해 처음 로그인한 뒤에는 임시 비밀번호를 반드시 변경해야 합니다. 비밀번호 변경 전에는 AIMAX 작업 실행이 제한됩니다.

업데이트 안내:

> 새로운 AIMAX 실행기 업데이트가 있습니다. 웹앱은 자동으로 최신 상태지만, 네이버 작업을 실행하는 로컬 실행기는 업데이트가 필요합니다. 업데이트 후 기존 설정과 로그인 정보는 유지됩니다.
