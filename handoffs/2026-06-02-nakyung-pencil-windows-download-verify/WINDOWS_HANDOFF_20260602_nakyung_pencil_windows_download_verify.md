# Windows Handoff - 나경 판서 직원 다운로드 검수

## 목적

AIMAX 운영 웹에 `나경` 직원을 `판서` 역할의 Windows 전용 직접 다운로드형 직원으로 추가했습니다. Windows 실제 환경에서 사용자 화면, admin 카탈로그, 그리고 `pencil` 앱의 Windows 설치 파일/릴리스 상태를 검수합니다.

## 현재 Mac-side 반영

- 직원명: `나경`
- 역할: `판서`
- 실행 방식: `external_download`
- 접근 정책: `public` / 무료 공개 / 신규 계정 자동 제공
- 지원 환경: `windows`
- 버전 표시: `1.0.0`
- 프로필 이미지: `/assets/avatar_nakyung.jpg`
- Repo: `https://github.com/makefriendscoltd-design/pencil`
- 버튼 라벨: `Setup exe 다운로드`
- Setup URL: `https://github.com/makefriendscoltd-design/pencil/releases/download/v1.0.0/Pencil-Setup-1.0.0.exe`
- Portable URL: `https://github.com/makefriendscoltd-design/pencil/releases/download/v1.0.0/Pencil-portable.exe`

## 중요한 현재 상태

Mac-side에서 `pencil` repo를 clone해 Windows EXE를 빌드했습니다. 빌드 산출물은 아래와 같습니다.

- commit: `9b02338f1be880297b0f1640dfde33186de71db0`
- setup: `Pencil-Setup-1.0.0.exe`, 약 84MB, SHA256 `6b974365a793826619933f1b0930ce0fbb5ad6bd278781325213afcd4187a4b0`
- portable: `Pencil-portable.exe`, 약 84MB, SHA256 `d9c31c8a71d88b293957413f71da3735fda8b0a52bfa3eb1eda69406c99f08af`

Mac-side GitHub CLI release 생성은 현재 로컬 GitHub 토큰에 `workflow` scope가 없어 실패했습니다. 권한을 넓히는 것보다 Windows 쪽에서 업로드/검증하는 편이 안전하다고 판단했습니다.

Syncthing 공유 폴더에는 아래 파일이 들어 있습니다.

- `Pencil-Setup-1.0.0.exe`
- `Pencil-portable.exe`

## Windows 검수 작업

1. 이 폴더의 최신 handoff 문서를 먼저 읽으세요.
2. Syncthing 공유 폴더 안에서 빌드하지 말고, repo를 Windows 로컬 작업 폴더로 clone/copy해서 확인하세요.
3. 비밀, 토큰, GitHub 인증 정보, API 키, 패스프레이즈는 Syncthing에 쓰지 마세요.
4. 공유 폴더의 EXE 두 개를 Windows 로컬 작업 폴더로 복사하세요. 공유 폴더에서 직접 실행/업로드하지 마세요.
5. 파일 해시를 확인하세요.
   - setup SHA256 `6b974365a793826619933f1b0930ce0fbb5ad6bd278781325213afcd4187a4b0`
   - portable SHA256 `d9c31c8a71d88b293957413f71da3735fda8b0a52bfa3eb1eda69406c99f08af`
6. `https://github.com/makefriendscoltd-design/pencil/releases/tag/v1.0.0`의 release/asset 상태를 Windows에서 확인하세요.
7. release asset이 아직 없고 Windows 쪽 GitHub 권한이 준비되어 있으면, 사용자 승인 범위 안에서 `v1.0.0` release를 만들고 아래 두 asset을 업로드하세요.
   - `Pencil-Setup-1.0.0.exe`
   - `Pencil-portable.exe`
   Windows 쪽에도 권한이 없으면 blocker로 보고하세요.
8. AIMAX 웹이 배포된 뒤 또는 Mac-side가 알려준 staging/production URL에서 Windows 브라우저로 확인하세요.
   - 직원 카드: `나경`, `판서`, `Windows 전용`
   - 상세: `Windows 앱 직접 다운로드`, `무료 공개`, 웹 작업 기록 없음
   - Windows 환경에서는 다운로드 버튼이 활성화되어야 합니다.
   - `Setup exe 다운로드`가 `Pencil-Setup-1.0.0.exe`를 실제로 내려받는지 확인하세요.
9. Admin 접근이 가능하면 `AIMAX Admin > 직원 카탈로그`에서 `나경`이 아래와 같이 보이는지 확인하세요.
   - `직접 다운로드`
   - `무료 공개`
   - `신규 계정 자동 제공`
   - `Windows 전용`
   - `v1.0.0`

## 반환 기대값

같은 Syncthing 폴더에 완료/블로커 보고서를 남겨주세요.

- Windows OS / 브라우저
- 확인한 AIMAX URL
- 나경 카드 및 상세 화면 스크린샷
- admin 카탈로그 스크린샷 또는 확인 여부
- 현재 버튼 URL과 동작
- `pencil` release/asset 존재 여부
- 빌드했다면 산출물 파일명, 크기, SHA256, 저장 위치
- 실제 release asset URL이 있다면 Mac-side가 넣어야 할 URL
- blocker와 다음 조치
