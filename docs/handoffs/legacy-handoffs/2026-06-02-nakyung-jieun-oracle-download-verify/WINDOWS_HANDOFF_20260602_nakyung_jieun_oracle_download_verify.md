# Windows Handoff - 나경/지은 Oracle 직접 다운로드 검증

## 목적

나경(판서)과 지은(AI 오피스 지원)이 GitHub Release가 아니라 Oracle 공개 다운로드 URL에서 Windows EXE를 직접 내려받는지 Windows 환경에서 확인한다.

## 운영 URL

- AIMAX app: `https://api.aimax.ai.kr/app`
- AIMAX admin: `https://api.aimax.ai.kr/admin`
- 나경 Setup: `https://api.aimax.ai.kr/downloads/Pencil-Setup-1.0.0.exe`
- 나경 Portable: `https://api.aimax.ai.kr/downloads/Pencil-portable.exe`
- 지은 Setup: `https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-Setup-0.1.4.exe`
- 지은 Portable: `https://api.aimax.ai.kr/downloads/AIMAX-Office-Manager-portable.exe`

## 기대 상태

- 나경: 이름 `나경`, 역할 `판서`, `Windows 전용`, `직접 다운로드`, 무료 공개, 버전 `v1.0.0`.
- 지은: 이름 `지은`, 역할 `AI 오피스 지원`, `Windows 전용`, `직접 다운로드`, 무료 공개, 버전 `v0.1.4`.
- 두 직원 모두 작업 composer 흐름에 들어가지 않고 설치형 앱 다운로드 버튼을 사용한다.
- Windows에서는 `Setup exe 다운로드` 버튼이 활성이고, Setup EXE를 직접 내려받는다.
- GitHub Release URL을 사용하면 안 된다.

## 검증

1. Windows 브라우저에서 `https://api.aimax.ai.kr/app` 접속.
2. 로그인 가능한 테스트/운영 계정 세션으로 직원 채용 화면을 연다. 비밀번호나 세션 쿠키를 Syncthing에 쓰지 않는다.
3. 나경/지은 카드가 Windows 전용 설치형 직원으로 보이는지 확인한다.
4. 나경의 `Setup exe 다운로드` 버튼을 눌러 다운로드 파일명이 `Pencil-Setup-1.0.0.exe`인지 확인한다.
5. 지은의 `Setup exe 다운로드` 버튼을 눌러 다운로드 파일명이 `AIMAX-Office-Manager-Setup-0.1.4.exe`인지 확인한다.
6. 다운로드한 파일 SHA256을 확인한다.
7. admin 접근이 가능하면 직원 카탈로그에서 `직접 다운로드`, `무료 공개`, `신규 계정 자동 제공`, `Windows 전용`, 버전을 확인한다.

## 기대 SHA256

- `Pencil-Setup-1.0.0.exe`: `6b974365a793826619933f1b0930ce0fbb5ad6bd278781325213afcd4187a4b0`
- `Pencil-portable.exe`: `d9c31c8a71d88b293957413f71da3735fda8b0a52bfa3eb1eda69406c99f08af`
- `AIMAX-Office-Manager-Setup-0.1.4.exe`: `82c98c8bfab019adc2ee6b45f0818ff4e5fc1a80a5c39ab8a968b50b89ab9e01`
- `AIMAX-Office-Manager-portable.exe`: `2b7270153e7d1ad03e209d170ed891598af68dcba1278abf501e980767fab0e8`

## 반환물

같은 Syncthing 폴더에 완료/차단 보고서를 남긴다.

- 확인한 URL
- 다운로드 파일명, 크기, SHA256
- 직원 카드/다운로드 버튼/admin 카탈로그 스크린샷
- 실패 시 visible error, 브라우저/Windows 버전, 재현 단계
- 비밀번호, 쿠키, 토큰, API 키, 개인 계정 정보는 기록하지 않는다.
