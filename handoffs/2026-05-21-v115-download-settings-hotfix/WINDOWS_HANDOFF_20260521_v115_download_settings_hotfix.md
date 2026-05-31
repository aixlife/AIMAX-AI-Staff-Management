# Windows Handoff 20260521 v1.0.15 Download + Local Settings Hotfix

## Goal

Build and verify a new Windows unified AIMAX installer that includes the download/local-settings hotfix already implemented in the Windows local work folder.

This must be a new Windows version, `v1.0.15`, because `v1.0.14` is already deployed and clients on `v1.0.14` will not be forced to update if we rebuild with the same version.

## Read First

- `20_Deploy-To-Windows\2026-05-21-download-settings-hotfix\MAC_ORACLE_DEPLOY_REQUEST_20260521_download_settings_hotfix.md`
- `20_Deploy-To-Windows\2026-05-21-download-settings-hotfix\WINDOWS_AI_STATUS_20260521_download_settings_hotfix.md`
- `20_Deploy-To-Windows\2026-05-21-v114-local-settings-ux\WINDOWS_COMPLETION_20260521_v114_local_settings_ux.md`
- `20_Deploy-To-Windows\2026-05-21-postdeploy-report-regression\WINDOWS_COMPLETION_20260521_postdeploy_report_regression.md`

## Current State

Windows has now returned two related things:

1. The local hotfix status report:
   - `2026-05-21-download-settings-hotfix\WINDOWS_AI_STATUS_20260521_download_settings_hotfix.md`
2. A Mac/Oracle deploy request with prepared web files:
   - `2026-05-21-download-settings-hotfix\MAC_ORACLE_DEPLOY_REQUEST_20260521_download_settings_hotfix.md`
   - `2026-05-21-download-settings-hotfix\oracle-web-hotfix-files\oracle\aimax-reports-api\server.js`
   - `2026-05-21-download-settings-hotfix\oracle-web-hotfix-files\oracle\aimax-reports-api\static\app.html`

The prepared web hotfix files have these SHA256 values:

- `server.js`: `59457cb6087d1072a8dbc34a0f6f446ddc83c7a01a005cc9acf3218598ec8346`
- `app.html`: `160c7aaf00fd212a3b565e10a9803750a614f35123fb633182ab556cf2a6677d`

Mac side will handle the Oracle/web deployment of those prepared web files. Windows should not block the installer rebuild on SSH access to Oracle.

The Windows hotfix report says these files were changed locally:

- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `local_agent/runtime.py`
- `app.py`
- `split_version/app.py`

Mac/Oracle verification found that the currently deployed server and Mac-side source do **not** yet contain the new hotfix markers:

- `downloads/tickets`
- `다운로드 여는 중`
- `aimax://agent/open-settings`
- `open-settings`

So this work is not fully deployed yet.

After Mac deploys the prepared web files, the website can improve download start/local-settings feedback immediately. However, a new Windows installer is still required for the local-agent protocol side of the fix.

## Required Changes To Include

Preserve everything from Windows `v1.0.14`:

- login IME guard
- keychain/safe-storage fallback
- local settings UX/key persistence
- editor/image-provider contract fix
- Songi runtime/media tools
- Songi entitlement/no-paid/redaction guards

Add the download/settings hotfix:

- Server download ticket flow:
  - `POST /api/downloads/tickets`
  - `GET /api/downloads/agent?ticket=...`
  - short-lived ticket, no secrets in URL beyond the ticket value
  - direct streaming so the browser native download starts promptly
- Web download UX:
  - no large `fetch -> blob` buffering for the installer
  - shared busy guard against repeated clicks
  - `다운로드 여는 중` feedback
  - clear Windows unsigned/download warning guidance
- Local settings command UX:
  - create `open_settings` command
  - poll command status
  - report `queued`/`delivered`/`done`/`failed`
  - fallback to `aimax://agent/open-settings` if command stays queued/stale
- Windows local agent protocol:
  - startup request detection for `open-settings`
  - single-instance request handling for `open_settings`
  - preserve `open_settings` request instead of converting it to `connect`

Also keep the prepared web hotfix in the installer's packaged `oracle/aimax-reports-api` runtime so the bundled/local Songi web backend and future packaged web runtime match production.

## Version Requirement

Set all Windows build/runtime metadata to `v1.0.15` / `AIMAX v1.0.15` / installer `1.0.15`.

Do not keep the installer at `v1.0.14`.

## Required Verification

Run from a local Windows work folder, not inside Syncthing.

```powershell
node --check oracle\aimax-reports-api\server.js
python -m py_compile app.py split_version\app.py local_agent\runtime.py
```

Run the app HTML script syntax check used in the prior hotfix:

```text
APP_HTML_SCRIPT_SYNTAX_OK
```

Run download ticket + command status smoke:

```text
ticket_download_status=200
command_status=queued
```

Run regressions:

```powershell
python verify_v113_login_ime_guard.py
python verify_v114_local_settings_ux.py
python scripts\verify_editor_image_provider_contract.py
python verify_v110_no_paid_editor_smoke.py
```

Expected:

```text
V113_LOGIN_IME_GUARD_OK
V114_LOCAL_SETTINGS_UX_OK
EDITOR_IMAGE_PROVIDER_CONTRACT_OK
V110_NO_PAID_EDITOR_SMOKE_OK
```

Run open-settings protocol static check:

```text
OPEN_SETTINGS_PROTOCOL_CHECK_OK
runtime_handles_open_settings_request=true
runtime_has_open_settings_handler=true
runtime_has_startup_kind=true
app_preserves_open_settings_signal=true
split_preserves_open_settings_signal=true
```

Run frozen diagnostics against the built app:

```powershell
$probe = "$env:TEMP\aimax-v115-diagnostics.json"
if (Test-Path -LiteralPath $probe) { Remove-Item -LiteralPath $probe -Force }
$p = Start-Process -FilePath 'dist\AIMAX\AIMAX.exe' -ArgumentList @('--diagnostics-probe', $probe) -Wait -PassThru -WindowStyle Hidden
"ExitCode=$($p.ExitCode)"
Get-Content -LiteralPath $probe -Raw
```

Expected:

- exit code `0`
- version `v1.0.15`
- frozen runtime `true`
- `ai_text_import_smoke.ok=true`

## Return Required

Return files to:

```text
C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-21-v115-download-settings-hotfix
```

Required return files:

- `WINDOWS_COMPLETION_20260521_v115_download_settings_hotfix.md`
- `aimax-bundle-windows.exe`
- `SHA256SUMS.txt`
- `source-files\oracle\aimax-reports-api\server.js`
- `source-files\oracle\aimax-reports-api\static\app.html`
- `source-files\local_agent\runtime.py`
- `source-files\app.py`
- `source-files\split_version\app.py`
- any verification scripts added or changed

The completion report must include:

- final installer SHA256
- changed file list
- version metadata proof
- all verification outputs
- whether the exact hotfix markers are present
- whether the returned `source-files` web files still match or intentionally supersede the Mac/Oracle deploy-request web files
- no-paid/no-secrets confirmation
- remaining blockers, if any

## Safety

- Do not use customer accounts, API keys, cookies, `.env`, browser profiles, setup links, signed URLs, or raw private logs.
- Do not run paid AI calls.
- Do not run Apify Actor calls.
- Do not run real Naver publish/save/draft/temporary-save tests.
- Do not build inside Syncthing. Copy needed inputs into the local Windows work folder first, then return only sanitized artifacts/reports.
