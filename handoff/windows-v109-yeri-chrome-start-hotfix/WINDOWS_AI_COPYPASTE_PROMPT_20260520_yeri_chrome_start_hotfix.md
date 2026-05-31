당신은 Windows AIMAX 빌드/검증 담당 AI 개발자입니다.

먼저 Syncthing 공유 폴더의 최신 handoff 문서를 읽어주세요. 특히 다음 문서를 기준으로 작업합니다.

- `WINDOWS_HANDOFF_20260520_yeri_chrome_start_hotfix.md`
- `windows-source-delta-20260520-yeri-chrome-start-hotfix.patch`

중요 규칙:

- Syncthing 공유 폴더 안에서 직접 빌드하지 마세요.
- 공유 폴더의 소스/패치를 Windows 로컬 작업 폴더로 복사한 뒤 작업하세요.
- `.env`, API 키, 토큰, 패스워드, 서명 URL, 개인 쿠키, 브라우저 프로필 원본을 Syncthing에 넣지 마세요.
- 유료 AI API 호출은 하지 마세요. 검증은 no-paid smoke 또는 mock으로 진행하세요.
- 작업 전 최신 handoff 문서를 읽고, 작업 후 완료/차단 보고서를 공유 폴더에 남겨주세요.

작업 목표:

Windows Local Agent v1.0.8 이후에도 예리 작업에서 `browser_start` 단계가 `cannot connect to chrome ... chrome not reachable`로 실패하는 문제를 줄이기 위한 v1.0.9 후보를 빌드/검증합니다.

해야 할 일:

1. Windows 로컬 작업 폴더에 AIMAX 소스를 준비합니다.
2. `windows-source-delta-20260520-yeri-chrome-start-hotfix.patch`를 적용합니다.
3. `browser/stealth_driver.py` 수정 내용을 확인합니다.
   - Windows에서 앱 전용 Chrome 프로필을 물고 있는 `chrome/chromedriver` 프로세스만 탐지/정리해야 합니다.
   - `chrome not reachable`, `cannot connect to chrome`, `session not created`, `DevTools` 계열 실패 시 앱 전용 프로필을 `.recover-YYYYMMDDHHMMSS`로 백업하고 새 프로필로 1회 재시도해야 합니다.
   - 사용자 일반 Chrome 프로필을 종료하거나 삭제하면 안 됩니다.
4. 문법 검증을 실행합니다.
   - `python -m py_compile browser/stealth_driver.py`
5. no-paid smoke를 실행합니다.
   - 앱 전용 임시 프로필로 `create_stealth_driver(profile_key="chrome_start_smoke")` 실행
   - `about:blank` 진입
   - `driver.quit()`
   - 가능하면 기존 앱 전용 프로필 잠금/프로세스 잔류 상황에서도 복구되는지 확인
6. 기존 Windows 빌드 절차에 맞춰 v1.0.9 후보 설치 파일을 빌드합니다.
   - 통합 번들 설치 파일 우선
   - 현재 운영 배포 방식에 필요하면 yeri/hyunju 분리 설치 파일도 함께 빌드
7. 공유 폴더에 완료 보고서를 작성합니다.

완료 보고서에 포함할 내용:

- 적용한 패치 요약
- 빌드한 파일명
- 각 파일 크기와 SHA256
- 실행 smoke 결과
- 예리 Chrome 시작 관련 검증 결과
- 실패 또는 미검증 항목과 그 이유
- Oracle 운영 반영이 필요한 파일 목록

완료 보고서 파일명:

`WINDOWS_COMPLETION_20260520_yeri_chrome_start_hotfix.md`
