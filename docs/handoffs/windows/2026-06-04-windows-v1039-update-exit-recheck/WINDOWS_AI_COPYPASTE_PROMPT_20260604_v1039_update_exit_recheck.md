너는 AIMAX Windows 개발자다. 먼저 아래 핸드오프를 읽고, Syncthing 공유 폴더 안에서 직접 빌드/수정하지 말고 로컬 Windows 작업 폴더로 필요한 파일을 복사해서 작업해줘.

읽을 파일:

`20_Deploy-To-Windows/2026-06-04-windows-v1039-update-exit-recheck/WINDOWS_HANDOFF_20260604_v1039_update_exit_recheck.md`

목표:

실제 고객이 Windows `v1.0.39` 상태에서 업데이트 파일/실행기가 바로 종료되어 `실행기 연결`이 안 된다고 신규 오류 보고를 보냈고, 기존 `v1.0.35-v1.0.39` 오류 보고 4건도 `아직 안 돼요`로 재확인했다. 이게 사용자 PC만의 보안/설치 문제인지, production installer/update flow 문제인지, stale request/lock 상태 문제인지 확인해줘.

중요 규칙:

- 고객 비밀번호, Naver 계정, API 키, 토큰을 요구하거나 Syncthing에 저장하지 마.
- 유료 AI 호출, 예리 유료 글쓰기, 이미지 생성, 네이버 발행/예약/임시저장은 하지 마.
- production 웹 UI에서 실제 사용자 경로로 확인하되 승인된 테스트 계정/세션만 사용해.
- Windows에서 설치/실행/연결을 직접 확인하고 증거를 남겨.

확인할 핵심 데이터:

- report IDs:
  - `AIMAX-RPT-20260601145545-8b47e0df`
  - `AIMAX-RPT-20260601074107-3760c7b0`
  - `AIMAX-RPT-20260601030134-c79e257d`
  - `AIMAX-RPT-20260529074031-53cbc6d0`
  - 신규: `AIMAX-RPT-20260603160447-1f8114f7`
- 운영 Windows required/latest: `v1.0.44`
- 고객 신규 보고 app/agent: `v1.0.39`, Windows
- 운영 installer:
  - 파일명: `aimax-bundle-windows.exe`
  - 크기: `35,673,438`
  - SHA256: `6fda2ee6ae3f4f3961e2e5a4555b084717a91d8a8d0900e92a7a09d08e5af93a`
- 신규 보고 진단:
  - stale request files 2개
  - `aimax-local-agent-request.json`
  - `aimax-local-agent.request.json`
  - 둘 다 약 47-49시간 stale

수행:

1. production 웹에서 Windows 업데이트/다운로드/실행기 연결 경로를 실제로 클릭해 확인.
2. 다운로드한 installer 크기/SHA 확인.
3. 설치/업데이트가 바로 종료되는지, SmartScreen/보안 프로그램/파일 잠금/프로세스 잔존 문제가 있는지 확인.
4. 설치 후 로컬 실행기가 `v1.0.44`로 인식되고 웹 UI에서 연결되는지 확인.
5. `%LOCALAPPDATA%\AIMAX`의 stale request/lock 파일 상태를 확인.
6. 문제가 재현되면 원인과 수정 포인트를 적어줘.
7. 완료/블로커 보고서와 스크린샷/로그 증거를 같은 공유 폴더에 반환해줘.

반환 보고서에 포함:

- Windows 환경/브라우저
- 설치 전/후 버전
- installer SHA/size
- 실행기 연결 결과
- stale request/lock 파일 상태
- 보안 차단 여부
- 재현 여부
- 다음 수정 필요 여부
