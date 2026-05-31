아래 작업을 Windows Codex 환경에서 진행해주세요.

목표:
- 방금 운영 배포된 AIMAX Windows 실행기 `v1.0.18` 설치본을 실제 설치/업데이트 관점에서 검증합니다.
- 이 검증이 통과해야 Mac/server 쪽에서 R3-C `ready_for_publish` claim flag를 켤 수 있습니다.

먼저 읽을 파일:

```text
20_Deploy-To-Windows\2026-05-25-r3c-windows-post-deploy-install-check\WINDOWS_HANDOFF_20260525_r3c_windows_post_deploy_install_check.md
```

중요:
- 코드는 수정하지 마세요. post-deploy 설치 검증입니다.
- 유료 AI 호출, Apify, Naver 로그인/저장/발행, 고객 계정 사용 금지입니다.
- 테스트 계정이 이미 Windows 환경에 안전하게 준비되어 있을 때만 연결 확인을 하세요.

검증할 것:

1. `aimax-bundle-windows.exe` SHA256 확인
   - 기대값: `F4730BFA12FEFD448C35E4FE66F7146110F3991DB3DC79B792EB3BBD9F5C143E`
2. 설치/업데이트 실행
3. 설치된 앱 기준 diagnostics probe 실행
4. public version API 확인
   - `v1.0.17` -> `update_required=true`
   - `v1.0.18` -> `update_required=false`
5. 가능하면 설치된 launcher 실행 후, 테스트 계정에서 update-required 배너가 사라지는지 확인

명령 예시:

```powershell
Get-FileHash .\aimax-bundle-windows.exe -Algorithm SHA256

curl.exe -fsS "https://api.aimax.ai.kr/api/version?platform=windows&current=v1.0.17"
curl.exe -fsS "https://api.aimax.ai.kr/api/version?platform=windows&current=v1.0.18"
curl.exe -fsS "https://api.aimax.ai.kr/api/reports/health"

& "$env:LOCALAPPDATA\Programs\AIMAX\AIMAX.exe" --diagnostics-probe "$env:TEMP\aimax_r3c_v118_installed_diag.json"
```

반드시 확인:

```text
system.app.version = v1.0.18
system.runtime.frozen = true
ai_text_import_smoke.ok = true
```

공유 폴더에 반환:

```text
20_Deploy-To-Windows\2026-05-25-r3c-windows-post-deploy-install-check\WINDOWS_RESULT_20260525_r3c_windows_post_deploy_install_check.md
20_Deploy-To-Windows\2026-05-25-r3c-windows-post-deploy-install-check\aimax_r3c_v118_installed_diag.json
```

보고서에는 다음을 포함하세요:

- verdict: `pass` / `blocked` / `fail`
- 설치된 앱 경로
- installer SHA256
- public version API 결과
- diagnostics 요약
- runner launch/agent connection 확인 여부
- customer credential, paid API, Naver mutation 미사용 확인
