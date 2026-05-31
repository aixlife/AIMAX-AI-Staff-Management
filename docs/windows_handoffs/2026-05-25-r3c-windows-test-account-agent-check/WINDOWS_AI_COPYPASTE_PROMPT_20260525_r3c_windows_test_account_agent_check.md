아래 작업을 Windows Codex 환경에서 진행해주세요.

목표:
- R3-C claim flag를 켜기 전, 안전한 비고객 테스트 계정으로 실제 사용자 흐름을 확인합니다.
- 코드 수정 작업이 아닙니다. 설치/연결/업데이트 배너 소멸 확인입니다.

먼저 읽을 파일:

```text
20_Deploy-To-Windows\2026-05-25-r3c-windows-test-account-agent-check\WINDOWS_HANDOFF_20260525_r3c_windows_test_account_agent_check.md
```

중요한 보안 규칙:
- 테스트 계정 비밀번호를 shared folder, 보고서, 터미널 로그, 스크린샷, `.env`, 소스 파일에 절대 남기지 마세요.
- 비밀번호는 대표님이 Windows 환경에 직접 입력하거나, 별도 안전한 로컬 방식으로만 처리하세요.
- 고객 계정 사용 금지입니다.
- 유료 AI 호출, Apify, Naver 로그인/저장/발행 금지입니다.

허용 범위:
1. AIMAX 웹앱 열기
2. 안전한 테스트 계정으로 로그인
3. 설치된 Windows 실행기 `v1.0.18` 실행
4. 웹앱에서 실행기 연결 확인
5. update-required 배너가 사라지는지 확인
6. 연결된 runner version이 `v1.0.18`인지 확인
7. claim flag가 아직 off인 상태에서 job이 실행되지 않는지 확인

사전 API 확인:

```powershell
curl.exe -fsS "https://api.aimax.ai.kr/api/version?platform=windows&current=v1.0.18"
curl.exe -fsS "https://api.aimax.ai.kr/api/reports/health"
```

설치 앱 diagnostics:

```powershell
& "$env:LOCALAPPDATA\Programs\AIMAX\AIMAX.exe" --diagnostics-probe "$env:TEMP\aimax_r3c_v118_test_account_diag.json"
```

기대:

```text
system.app.version=v1.0.18
system.runtime.frozen=true
ai_text_import_smoke.ok=true
```

수동 UI 체크:
1. `https://api.aimax.ai.kr/app` 접속
2. 테스트 계정 로그인
3. 설치된 AIMAX runner 실행
4. 실행기 연결
5. 대시보드/업데이트 탭에서 Windows `v1.0.18`이 최신으로 인식되는지 확인
6. update-required 배너가 남아있지 않은지 확인
7. 작업 생성/실행은 하지 않음

반환 파일:

```text
20_Deploy-To-Windows\2026-05-25-r3c-windows-test-account-agent-check\WINDOWS_RESULT_20260525_r3c_windows_test_account_agent_check.md
20_Deploy-To-Windows\2026-05-25-r3c-windows-test-account-agent-check\aimax_r3c_v118_test_account_diag.json
```

보고서에 포함:
- verdict: `pass` / `blocked` / `fail`
- 설치 앱 경로
- diagnostics 요약
- version API 요약
- 테스트 계정 로그인 결과, 단 계정/비밀번호는 redacted
- runner 연결 상태
- 연결 runner version
- update-required 배너 소멸 여부
- job 생성/claim 여부
- paid API / Apify / Naver mutation / customer credential 미사용 확인
