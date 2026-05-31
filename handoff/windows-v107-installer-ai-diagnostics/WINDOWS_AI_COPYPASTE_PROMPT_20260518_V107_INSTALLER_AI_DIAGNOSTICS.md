아래 공유 폴더의 최신 문서를 먼저 읽고 Windows v1.0.7 후속 보강을 진행해주세요.

공유 폴더:
`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/AIMAX-20260518-windows-v107-installer-ai-diagnostics/`

먼저 읽을 파일:

1. `WINDOWS_AI_DEVELOPER_MESSAGE_20260518_V107_INSTALLER_AI_DIAGNOSTICS.md`
2. `aimax-windows-v106-followup-evidence-20260518.json`

중요 절차:

- Syncthing 공유 폴더 안에서 직접 빌드하지 말고, Windows 로컬 작업 폴더로 소스를 복사한 뒤 작업해주세요.
- 기존 v1.0.6 작업 폴더가 남아 있으면 그걸 기준으로 시작하세요.
- 없으면 이전 handoff의 `aimax-unified-launcher-guard-source-20260518.zip`을 풀고 `windows-source-delta-20260518-unified-launcher-guard-v106.patch`를 적용한 뒤 시작하세요.
- `.env`, API 키, 네이버 비밀번호, 세션/쿠키, 인증 헤더, 개인 설정 파일은 Syncthing에 넣지 마세요.
- 실제 유료 AI 생성이나 실제 네이버 발행 테스트는 하지 말고, provider/mock/stub으로 검증해주세요.

이번 v1.0.7 목표:

1. 설치/업데이트 중 AIMAX가 실행 중이어도 `deletefile 실패: 코드 5`가 나오지 않게 처리하거나, 닫아야 할 프로세스를 한국어로 명확히 안내.
2. 로컬 `localhost:8669` 실행기가 120초 타임아웃될 때 작업이 막연히 멈추지 않고, health check/restart/fail 처리가 명확히 남도록 보강.
3. `content_generation` 실패가 `글 생성 실패: 키워드`로만 끝나지 않게 OpenAI/Gemini/Claude provider, model, HTTP status, sanitized error, request id, usage/cost를 가능한 범위에서 job result와 로그에 남김.
4. `APP_VERSION` 및 Inno `AppVersion`을 `v1.0.7` / `1.0.7`로 올리고 Windows 설치파일 3종을 재빌드.

반환 파일:

- `WINDOWS_AI_COMPLETION_REPORT_20260518_V107_INSTALLER_AI_DIAGNOSTICS.md`
- `windows-source-delta-20260518-v106-to-v107-installer-ai-diagnostics.patch`
- `aimax-windows-v107-installer-ai-diagnostics-evidence-20260518.json`
- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`
- `SHA256SUMS.txt`

완료 보고서에는 다음을 반드시 적어주세요:

- 설치 중 실행 중인 AIMAX 처리 검증 결과
- `localhost:8669` timeout mock 검증 결과
- OpenAI/Gemini/Claude content generation error mock 검증 결과
- 단일 인스턴스/프로토콜 연결 회귀 테스트 결과
- `open_settings` 회귀 테스트 결과
- 실제 유료 AI 생성/실제 네이버 발행을 실행했는지 여부
- 모든 산출물 SHA256

