# Windows Handoff - 지원 AI 오피스 직원 다운로드 검수

날짜: 2026-06-01 KST
작성: Mac Codex
보안: 비밀값 없음. 비밀번호, 토큰, 쿠키, API 키를 Syncthing에 저장하지 말 것.

## 목적

AIMAX 운영 웹앱에 새 직원 `지원`을 추가했습니다. 직원 역할은 `AI 오피스 지원`이며, 현재는 Windows 전용 직접 다운로드형 직원입니다.

Windows 환경에서 실제 사용자 흐름으로 아래를 검수해주세요.

## 운영 반영 내용

- 직원명: `지원`
- 역할: `AI 오피스 지원`
- 실행 방식: `external_download`
- 접근 정책: `무료 공개`
- 신규 계정 처리: 계정 생성 시 별도 상품 권한을 추가하지 않아도 모든 로그인 사용자에게 자동 제공
- 지원 환경: 현재 `Windows 전용`
- 기본 다운로드: `AIMAX-Office-Manager-Setup-0.1.4.exe`
- 보조 다운로드: `AIMAX-Office-Manager-portable.exe`는 설치가 막히는 환경용
- 릴리스 저장소: `https://github.com/aixlife/aimax-viseo-releases/releases/tag/v0.1.4`

## Mac/서버 검증 완료

- `node --check oracle/aimax-reports-api/server.js` 통과
- `node scripts/smoke_worker_catalog_contract.mjs` 통과
- `app.html`, `admin.html` inline script parse 통과
- 로컬 macOS UI: 지원 카드가 `Windows 전용`으로 표시되고 다운로드 버튼 비활성화 확인
- Windows UA 시뮬레이션 UI: 지원 카드가 `다운로드 가능`, 버튼 `Setup exe 다운로드` 활성화 확인
- Admin UI: 지원 카드에 `무료 공개`, `신규 계정 자동 제공`, `Windows 전용`, `v0.1.4`, `Setup exe 다운로드` 표시 확인
- 운영 배포 완료: `docs/deployments/oracle-deploy-20260601-165019.md`
- 운영 `/api/workers`: `지원`, `AI 오피스 지원`, `external_download`, `public`, `supported_platforms=["windows"]` 확인
- GitHub Setup exe HEAD 확인: HTTP 200, filename `AIMAX-Office-Manager-Setup-0.1.4.exe`, size `161141736`

## Windows 검수 절차

1. Windows 실제 브라우저에서 `https://api.aimax.ai.kr/app`를 엽니다.
2. 승인된 AIMAX 테스트 계정/세션으로 로그인합니다. 비밀번호, 쿠키, 토큰은 문서에 쓰지 않습니다.
3. `직원` 탭으로 이동합니다.
4. `지원` 카드가 보이는지 확인합니다.
5. 카드/상세에서 아래 문구와 상태를 확인합니다.
   - 직원명 `지원`
   - 역할 `AI 오피스 지원`
   - 상태 `다운로드 가능`
   - 설명에 `Windows 전용`
   - 액션 버튼 `Setup exe 다운로드`
6. 버튼을 클릭해 다운로드가 시작되는지 확인합니다.
7. 다운로드 파일명이 `AIMAX-Office-Manager-Setup-0.1.4.exe`인지 확인합니다.
8. 가능하면 파일 크기가 약 153.7MB 또는 `161141736` bytes 수준인지 확인합니다.
9. Admin 접근이 가능하다면 `AIMAX Admin > 직원 카탈로그`에서 `지원` 카드가 `무료 공개`, `신규 계정 자동 제공`, `Windows 전용`으로 보이는지 확인합니다.

## 금지/주의

- 이번 검수에서 AIMAX 웹/서버/Windows 앱 코드를 수정하지 마세요.
- 고객 계정, 비밀번호, 토큰, 쿠키, API 키, 네이버 정보는 Syncthing에 저장하지 마세요.
- 유료 AI, Apify, Naver 자동화, AIMAX 실행기 버전 API, 설치파일 교체는 하지 마세요.
- 다운로드 검수는 Setup exe 경로가 열리는지만 확인합니다. 설치/실행까지 진행할 경우 별도 기록하고, 보안 경고/SmartScreen 여부를 함께 남겨주세요.

## 반환 기대값

같은 폴더에 아래 파일로 결과를 남겨주세요.

- `WINDOWS_RESULT_20260601_jiwon_office_support_download_verify.md`

포함할 내용:

- Windows 브라우저/OS 정보
- 테스트 계정 식별자는 이메일 일부 마스킹 또는 승인된 demo 계정명만
- `지원` 카드 표시 여부
- `다운로드 가능` 상태 여부
- 다운로드 버튼 라벨
- 다운로드 파일명/크기
- Admin 카탈로그 확인 여부
- 스크린샷 파일명
- blocker가 있으면 사용자 관점의 증상과 재현 단계
