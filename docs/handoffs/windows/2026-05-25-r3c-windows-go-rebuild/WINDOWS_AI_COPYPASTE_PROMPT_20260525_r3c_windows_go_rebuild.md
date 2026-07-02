아래 작업을 Windows Codex 환경에서 진행해주세요.

중요:
- 지금 말하는 Codex는 Windows PC 안의 Codex입니다. MacBook 쪽 Codex/Claude/Antigravity와 별도 환경입니다.
- 공유 폴더 안에서 빌드하지 말고, 반드시 로컬 Windows 작업 폴더로 복사해서 진행하세요.
- 유료 AI 호출, Apify, Naver 로그인/저장/발행, 고객 데이터 사용은 금지입니다.

먼저 읽을 파일:

```text
20_Deploy-To-Windows\2026-05-25-r3c-yeri-local-artifact-consumer\WINDOWS_RESULT_20260525_r3c_yeri_local_artifact_consumer.md
20_Deploy-To-Windows\2026-05-25-r3c-windows-go-rebuild\WINDOWS_HANDOFF_20260525_r3c_windows_go_rebuild.md
```

목표:

- R3-C 예리 Local Artifact Consumer를 포함한 Windows 설치본을 재빌드합니다.
- 이전 Windows 검증은 smoke는 통과했지만 Go가 없어서 `aimax-agent-launcher.exe` 생성이 막혔습니다.
- 이번에는 Go 설치 또는 `AIMAX_GO_EXE` 지정 후 Windows installer까지 만들어 반환합니다.

소스:

```text
20_Deploy-To-Windows\2026-05-25-r3c-windows-go-rebuild\aimax_r3c_yeri_local_artifact_consumer_source_bundle_20260525.zip
```

기대 SHA256:

```text
f84ff794808fb36c3246c861892ac8f0ef9600bafff6794dc930e7890f1751e7
```

작업 순서:

1. 공유 폴더의 ZIP과 handoff를 Windows 로컬 작업 폴더로 복사하세요.
2. ZIP SHA256을 확인하세요.
3. 전체 Windows AIMAX checkout에 overlay 적용하세요.
4. Go를 확인하세요.
   - `go version`
   - 없으면 설치 가능한 환경인지 확인 후 official Go toolchain을 설치하거나, 이미 있는 `go.exe` 경로를 `AIMAX_GO_EXE`로 지정하세요.
5. Windows 릴리스 버전을 `v1.0.18`로 맞추세요.
   - `aimax_compliance.py`
   - `split_version\aimax_compliance.py`
   - 두 파일 모두 `APP_VERSION = "v1.0.18"`
6. 아래 검증을 실행하세요.

```powershell
go version
node --check oracle\aimax-reports-api\server.js
node --check scripts\smoke_yeri_ready_claim_gate.mjs
node --check scripts\smoke_yeri_server_generation_mock.mjs
node --check scripts\smoke_yeri_paid_generation_guard.mjs
node --check scripts\smoke_yeri_hybrid_foundation.mjs
node --check scripts\smoke_yeri_hybrid_retry_api.mjs
node --check scripts\smoke_job_platform_targeting.mjs
python -m py_compile app.py split_version\app.py web_agent\client.py scripts\smoke_yeri_local_artifact_contract.py

python scripts\smoke_yeri_local_artifact_contract.py
node scripts\smoke_yeri_hybrid_foundation.mjs
node scripts\smoke_yeri_server_generation_mock.mjs
node scripts\smoke_yeri_paid_generation_guard.mjs
node scripts\smoke_yeri_ready_claim_gate.mjs
node scripts\smoke_yeri_hybrid_retry_api.mjs
node scripts\smoke_job_platform_targeting.mjs
node scripts\smoke_worker_catalog_contract.mjs
node scripts\smoke_json_storage_safety.mjs
node scripts\smoke_yunmi_access_gate.mjs
```

7. 빌드하세요.

```powershell
python build.py
```

8. Inno Setup으로 installer를 만드세요.

```powershell
iscc packaging\windows\aimax_installer.iss /DAppVersion=1.0.18 /DSourceDir="dist\AIMAX" /DOutputDir="dist\upload_installers" /DOutputBaseFilename="aimax-bundle-windows"
```

`iscc`가 없으면 v1.0.17 때 사용한 기존 installer build 절차를 사용하고, 실제 명령을 보고서에 적어주세요.

9. diagnostics probe를 실행하세요.

```powershell
.\dist\AIMAX\AIMAX.exe --diagnostics-probe C:\tmp\aimax_r3c_v118_diag.json
```

반드시 확인:

```text
system.app.version = v1.0.18
system.runtime.frozen = true
ai_text_import_smoke.ok = true
```

10. installer hash를 생성하세요.

```powershell
Get-FileHash .\dist\upload_installers\aimax-bundle-windows.exe -Algorithm SHA256
```

공유 폴더에 반환할 파일:

```text
20_Deploy-To-Windows\2026-05-25-r3c-windows-go-rebuild\WINDOWS_RESULT_20260525_r3c_windows_go_rebuild.md
20_Deploy-To-Windows\2026-05-25-r3c-windows-go-rebuild\aimax-bundle-windows.exe
20_Deploy-To-Windows\2026-05-25-r3c-windows-go-rebuild\SHA256SUMS_r3c_windows_go_rebuild.txt
20_Deploy-To-Windows\2026-05-25-r3c-windows-go-rebuild\aimax_r3c_v118_diag.json
```

보고서에는 다음을 포함하세요:

- verdict: `pass` / `blocked` / `fail`
- Go 버전 또는 정확한 Go blocker
- Windows OS / Node / Python / PyInstaller / Inno Setup 버전
- smoke 결과
- 사용한 빌드 명령
- diagnostics probe 요약
- installer 파일 크기와 SHA256
- paid/no-mutation 준수 확인

Pass 기준:
- Go 사용 가능
- no-paid smoke 전부 통과
- `AIMAX.exe`, `aimax-agent-launcher.exe` 생성
- `aimax-bundle-windows.exe` 생성
- diagnostics probe가 `v1.0.18`, `frozen=true` 보고
- SHA256 반환
