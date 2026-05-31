# Windows Handoff — R3-C Windows Go Rebuild

Date: 2026-05-25

## Purpose

Finish the Windows installer gate for R3-C Yeri Local Artifact Consumer.

The previous Windows pass proved the source contract and no-paid smokes, but returned `blocked` because Go was missing and the native launcher could not be rebuilt.

Important distinction:

- This is for the separate Windows Codex environment.
- Mac Codex/Claude/Antigravity are not the Windows build environment.
- Do not treat Mac-side build success as Windows release success.

## Previous Result To Read First

Read this report before doing any work:

```text
20_Deploy-To-Windows\2026-05-25-r3c-yeri-local-artifact-consumer\WINDOWS_RESULT_20260525_r3c_yeri_local_artifact_consumer.md
```

Previous verdict:

```text
blocked
```

Blocker:

```text
Go compiler not installed or available on PATH.
build.py requires Go to build aimax-agent-launcher.exe.
```

## Source Bundle

Use the same R3-C source bundle:

```text
aimax_r3c_yeri_local_artifact_consumer_source_bundle_20260525.zip
```

SHA256:

```text
f84ff794808fb36c3246c861892ac8f0ef9600bafff6794dc930e7890f1751e7
```

This handoff folder includes a copy of that ZIP for convenience. If you instead use the prior R3-C folder copy, verify the same SHA256.

## Target Windows Release Version

Target Windows Local Agent release:

```text
v1.0.18
```

Before building on Windows, update these files in the local Windows work folder only:

```text
aimax_compliance.py
split_version\aimax_compliance.py
```

Set:

```python
APP_VERSION = "v1.0.18"
```

Reason: live Windows version policy is currently `v1.0.17`. R3-C changes local runner behavior, so a new installer must not report an older app version.

## Windows Task

1. Copy this handoff folder contents out of Syncthing/shared folder into a local Windows work folder.
2. Do not build or test inside the shared folder.
3. Overlay the R3-C source bundle onto the full local Windows AIMAX checkout.
4. Install or locate Go:
   - If Go is already installed, confirm `go version`.
   - If Go exists outside PATH, set `AIMAX_GO_EXE` to the full `go.exe` path.
   - If Go is not installed and installation is allowed in that environment, install the official Go toolchain, then reopen the shell and confirm `go version`.
5. Bump Windows local source version to `v1.0.18` in both compliance files.
6. Run the no-paid smokes again.
7. Build the Windows app folder with `python build.py`.
8. Build the installer with Inno Setup using the checked-in template.
9. Run diagnostics probe against the built app.
10. Return the installer, hashes, and report to the shared folder.

## Required Verification

Run from the local Windows work folder:

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

Expected markers:

```text
YERI_LOCAL_ARTIFACT_CONTRACT_SMOKE_OK
YERI_HYBRID_FOUNDATION_SMOKE_OK
YERI_SERVER_GENERATION_MOCK_SMOKE_OK
YERI_PAID_GENERATION_GUARD_SMOKE_OK
YERI_READY_CLAIM_GATE_SMOKE_OK
YERI_HYBRID_RETRY_API_SMOKE_OK
JOB_PLATFORM_TARGETING_SMOKE_OK
WORKER_CATALOG_CONTRACT_SMOKE_OK
JSON_STORAGE_SAFETY_SMOKE_OK
YUNMI_ACCESS_GATE_SMOKE_OK
```

## Build Commands

App folder:

```powershell
python build.py
```

Expected:

```text
dist\AIMAX\AIMAX.exe
dist\AIMAX\aimax-agent-launcher.exe
```

Installer:

```powershell
iscc packaging\windows\aimax_installer.iss /DAppVersion=1.0.18 /DSourceDir="dist\AIMAX" /DOutputDir="dist\upload_installers" /DOutputBaseFilename="aimax-bundle-windows"
```

If `iscc` is unavailable, use the existing Windows installer build procedure used for v1.0.17, but report the exact command.

Diagnostics:

```powershell
.\dist\AIMAX\AIMAX.exe --diagnostics-probe C:\tmp\aimax_r3c_v118_diag.json
```

Required diagnostics:

```text
system.app.version = v1.0.18
system.runtime.frozen = true
ai_text_import_smoke.ok = true
```

Hash:

```powershell
Get-FileHash .\dist\upload_installers\aimax-bundle-windows.exe -Algorithm SHA256
```

## Do Not Enable Server Flags

Do not change production server env from Windows.

Keep these off unless Mac/server explicitly activates them later:

```text
AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED
AIMAX_YERI_SERVER_GENERATION_ENABLED
```

## No-Paid / No-Mutation Rules

- Do not run real Gemini/OpenAI/Claude/Apify calls.
- Do not run Naver login, save, publish, scheduled publish, or browser automation.
- Do not use customer credentials.
- Do not include API keys, cookies, `.env`, browser profiles, signed URLs, or private logs in Syncthing.

## Return Files

Return to this shared folder:

```text
WINDOWS_RESULT_20260525_r3c_windows_go_rebuild.md
aimax-bundle-windows.exe
SHA256SUMS_r3c_windows_go_rebuild.txt
aimax_r3c_v118_diag.json
```

Report must include:

- verdict: `pass`, `blocked`, or `fail`
- Go version or exact Go blocker
- Windows OS / Node / Python / PyInstaller / Inno Setup versions
- smoke outputs
- build commands used
- diagnostics probe summary
- installer size and SHA256
- confirmation that no paid/no Naver/no customer-secret operations ran

## Pass Criteria

This handoff is `pass` only if all are true:

1. Go is available.
2. No-paid smokes pass.
3. `python build.py` produces `AIMAX.exe` and `aimax-agent-launcher.exe`.
4. Inno Setup produces `aimax-bundle-windows.exe`.
5. diagnostics probe reports `v1.0.18`, `frozen=true`.
6. Installer SHA256 is returned.

