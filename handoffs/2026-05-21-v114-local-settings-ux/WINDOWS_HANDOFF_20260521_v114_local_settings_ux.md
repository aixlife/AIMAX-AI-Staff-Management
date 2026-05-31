# Windows Handoff - v1.0.14 Local Settings UX + Key Persistence

Date: 2026-05-21 KST

## Goal

Build and verify a Windows unified AIMAX installer that includes the macOS `v1.0.9` local-settings UX and credential persistence fixes, on top of the already deployed Windows `v1.0.13` login IME guard.

## Read First

1. `20_Deploy-To-Windows/2026-05-21-v113-login-ime-guard/WINDOWS_COMPLETION_20260521_v113_login_ime_guard.md`
2. This handoff.

## Context

User-visible issues found on macOS, likely possible on Windows too:

- Dashboard "로컬 설정 열기" felt slow because command polling could wait up to 20 seconds.
- Local security settings dialog was fixed-size and clipped on high-DPI/small-height screens, hiding the save button.
- Existing API keys could appear missing after the keychain/credential-store fallback changes.
- Keychain/credential-manager unavailable users still need a usable local fallback path.
- Users need a direct API-key issuance guide link from local settings.

macOS `v1.0.9` has already been deployed to Oracle with:

- resizable/scrollable local settings dialog
- faster command polling
- API key guide link
- previous secret recovery path
- safe legacy base64 decode
- blank-field save clears fallback and blocks legacy auto-resurrection
- dashboard button text while opening settings

Notion API key guide:

`https://www.notion.so/367b31f1da5581ed9b11f23757476cd2`

## Source Reference

Use the files under this folder as reference/merge input:

- `source-files/app.py`
- `source-files/split_version/app.py`
- `source-files/local_agent/runtime.py`
- `source-files/oracle/aimax-reports-api/static/app.html`

Do not blindly overwrite Windows metadata. Merge the behavior changes into the current Windows work folder and preserve Windows-specific build/packaging conventions.

## Required Windows Changes

- Bump Windows app/runtime metadata to `v1.0.14`.
  - `aimax_compliance.py`
  - `split_version/aimax_compliance.py`
  - `packaging/windows/aimax_installer.iss`
  - release/readme docs if they contain version text
- Keep all Windows `v1.0.13` login IME guard behavior.
- Add local settings dialog improvements:
  - resizable window
  - scrollable form area
  - Save/Cancel always visible
  - status text for prior storage recovery
  - API key guide button
- Add secret persistence hardening:
  - `API_KEY_GUIDE_URL`
  - `recover_missing_settings_secrets()`
  - safe legacy base64 decode
  - `cleared_secret_keys` tombstone handling
  - blank secret save deletes fallback and blocks automatic legacy resurrection
  - GUI settings panel background recovery path
- Add faster command polling:
  - `AIMAX_AGENT_COMMAND_POLL_SECONDS` default 5 seconds
  - heartbeat interval remains separately configurable
- Add dashboard button feedback if this Windows branch includes web static files:
  - button label: `설정 창 여는 중...`
  - toast: `보통 5초 안에 창이 열립니다.`

## No-Paid / No-Secrets Safety

Do not send, copy, print, or upload:

- customer data
- API keys
- passwords
- cookies
- `.env`
- browser profiles
- signed URLs
- raw private logs

Do not run:

- paid AI generation
- Apify Actor runs
- real Naver publish/save/draft tests

If you need to test secret behavior, use fake values such as `test-gemini-value` and assert only booleans/counts. Do not print raw local environment values.

## Required Verification

Run at minimum:

```powershell
python -m py_compile web_agent\client.py app.py split_version\app.py local_agent\runtime.py aimax_compliance.py split_version\aimax_compliance.py
```

Run existing preserved tests if present:

```powershell
python verify_v113_login_ime_guard.py
python scripts\verify_editor_image_provider_contract.py
```

Add/run a no-secret local smoke equivalent to:

- damaged legacy base64 password does not crash `load_settings()`
- blank saved secret creates a cleared marker and does not auto-restore from fallback
- real fake secret saves and reloads
- `AIMAX_AGENT_COMMAND_POLL_SECONDS` exists in both `app.py` and `split_version/app.py`
- local settings dialog source contains `root.resizable(True, True)`, scrollbar, `API 키 발급 가이드`, and `settings_recoverer`

Build unified Windows installer:

- output: `aimax-bundle-windows.exe`
- expected installer version: `1.0.14`
- frozen diagnostics version: `v1.0.14`

No real login is required unless the user explicitly types credentials directly into the GUI. If a live GUI pass is performed, never log or return secrets.

## Return To Shared Folder

Return these files to this shared folder:

- `WINDOWS_COMPLETION_20260521_v114_local_settings_ux.md`
- `aimax-bundle-windows.exe`
- `SHA256SUMS.txt`
- any verification script added for v1.0.14

Completion report must include:

- exact files changed
- build commands
- verification commands and outputs
- installer SHA256
- whether Windows local settings dialog was checked for small-screen/button visibility
- confirmation that no paid AI/API/Naver tests were run

## Deploy Boundary

Do not update Oracle production from Windows unless explicitly asked. Return the installer and report first. Mac v1.0.9 is already deployed.

