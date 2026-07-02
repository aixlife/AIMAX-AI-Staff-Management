# Windows Handoff - 지은 AI 오피스 직원 이름/프로필 검수

날짜: 2026-06-01 KST
작성: Mac Codex
상태: Windows 검수 요청

## 목적

AIMAX 운영 웹앱의 AI 오피스 지원 직원 이름이 `지원`에서 `지은`으로 바뀌었고, 프로필 이미지가 새 JPG로 교체되었습니다. Windows 실제 브라우저에서 사용자 화면과 admin 카탈로그가 최신 표시를 보여주는지 확인합니다.

## 변경 요약

- 직원명: `지은`
- 역할: `AI 오피스 지원`
- 내부 staff code: `jieun`
- 실행 방식: `external_download`
- 접근 정책: `accessPolicy=public`
- 지원 환경: 현재 `Windows 전용`
- 프로필 이미지: `/assets/avatar_jieun.jpg`
- 기본 버튼: `Setup exe 다운로드`
- 운영 배포 리포트: `docs/deployments/oracle-deploy-20260601-171913.md`

## Mac/운영 검증 완료

- `node --check oracle/aimax-reports-api/server.js`: 통과
- `node scripts/smoke_worker_catalog_contract.mjs`: 통과
- app/admin inline script parse: 통과
- 로컬 UI:
  - macOS 조건: `지은`, `AI 오피스 지원`, 이미지 로딩, `Windows 전용`, 버튼 비활성화 확인
  - Windows 조건: `지은`, 이미지 로딩, `다운로드 가능`, `Setup exe 다운로드`, 버튼 활성화 확인
  - 첫 로그인 비밀번호 변경 전 상태에서도 무료 공개 직원 `지은`은 표시됨
- 로컬 admin UI:
  - `지은`
  - `직접 다운로드`
  - `무료 공개`
  - `신규 계정 자동 제공`
  - `Windows 전용`
  - `v0.1.4`
- 운영 API:
  - `/api/workers`에서 `jieun_office_support`, `name=지은`, `profile_image=/assets/avatar_jieun.jpg`, `access_policy=public` 확인
  - `/assets/avatar_jieun.jpg` GET 200, `image/jpeg`, 42943 bytes 확인

## Windows 검수 절차

1. Syncthing 공유 폴더의 문서를 먼저 읽습니다.
2. 코드는 수정하지 않습니다. 이번 작업은 운영 UI 검수만 합니다.
3. Windows Chrome에서 `https://api.aimax.ai.kr/app`을 엽니다.
4. 승인된 테스트 계정/세션으로 로그인합니다. 비밀번호, 쿠키, 토큰은 기록하지 않습니다.
5. 브라우저 전체 reload를 한 번 수행해 최신 앱 파일을 받습니다.
6. `직원` 탭에서 `지은` 카드가 보이는지 확인합니다.
7. 다음 항목을 확인합니다.
   - 직원명이 `지은`인지
   - 예전 표시명 `지원`이 직원명으로 남아 있지 않은지
   - 역할이 `AI 오피스 지원`인지
   - 프로필 이미지가 placeholder가 아니라 새 인물 이미지로 보이는지
   - 상태가 Windows에서 `다운로드 가능`인지
   - 버튼이 `Setup exe 다운로드`이고 활성화되어 있는지
8. 다운로드 버튼은 이미 이전 검수에서 파일 크기까지 확인했으므로, 이번에는 클릭이 필수는 아닙니다. 단, 클릭할 경우 같은 파일 `AIMAX-Office-Manager-Setup-0.1.4.exe`가 시작되는지만 확인하고 설치/실행은 하지 않습니다.
9. Admin 접근이 가능하면 `AIMAX Admin > 직원 카탈로그`에서 `지은` 카드가 다음 표시를 포함하는지 확인합니다.
   - `직접 다운로드`
   - `무료 공개`
   - `신규 계정 자동 제공`
   - `Windows 전용`
   - `v0.1.4`
10. 스크린샷을 같은 폴더에 저장합니다.

## 반환 기대값

같은 Syncthing 폴더에 아래 파일을 남깁니다.

- `WINDOWS_RESULT_20260601_jieun_office_support_name_profile_verify.md`
- 스크린샷 파일 1개 이상

결과 문서에는 Windows OS/브라우저, 테스트 계정 식별자(마스킹), `지은` 카드 표시 여부, 예전 이름 잔존 여부, 프로필 이미지 표시 여부, 버튼 상태, admin 확인 여부, blocker를 포함해주세요.

## 금지

- Secrets, passphrases, API keys, cookies, raw session tokens, private account data를 Syncthing에 저장하지 않습니다.
- 운영 코드 수정, 배포, 버전 API 수정은 하지 않습니다.
- 유료 API 호출이나 설치 파일 실행은 하지 않습니다.
