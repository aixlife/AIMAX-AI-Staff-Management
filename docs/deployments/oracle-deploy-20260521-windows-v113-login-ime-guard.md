# Oracle Deploy 20260521 Windows v1.0.13 Login IME Guard

## Summary

Deployed Windows AIMAX Local Agent `v1.0.13` from the Windows completion return in Shared-Bridge.

## Source Return

- Shared-Bridge folder:
  - `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-v113-login-ime-guard`
- Completion report:
  - `WINDOWS_COMPLETION_20260521_v113_login_ime_guard.md`
- Returned installer:
  - `aimax-bundle-windows.exe`

## Fixes

- Blocks Hangul, leading/trailing spaces, and non-visible/non-ASCII web password input before HTTP login.
- Clears rejected password input.
- Shows Korean/English IME warning on web password field focus.
- Starts first-run Local Agent polling/heartbeat before opening the local security settings dialog.
- Preserves `v1.0.12` login/safe-storage fixes.
- Preserves previous editor/image-provider fixes.

## Returned Verification

- `python -m py_compile ...`: passed
- `verify_v113_login_ime_guard.py`: `V113_LOGIN_IME_GUARD_OK`
- Friendly login messages: `LOGIN_FRIENDLY_ERROR_MESSAGES_OK`
- Editor/image provider contract: `EDITOR_IMAGE_PROVIDER_CONTRACT_OK`
- No-paid editor smoke: `V110_NO_PAID_EDITOR_SMOKE_OK`
- Frozen diagnostics:
  - `version`: `v1.0.13`
  - `version_label`: `AIMAX v1.0.13`
  - `frozen`: `true`
  - `ai_text_import_smoke.ok`: `true`

## Artifact

- Local returned artifact:
  - `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-v113-login-ime-guard/aimax-bundle-windows.exe`
- Remote:
  - `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
- SHA256:
  - `bb2510cbb994eef03ee000e17dd0a678094c02dec4228e7a351cb634f5b68b38`

## Backup

- `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe.v1.0.12.backup-20260521-v113-login-ime-guard`
- SHA256:
  - `b3faf598c57725a257efb60509af2d8faf8d62cb99f1038a357969409df05222`

## Version API

- Windows `current=v1.0.12` -> latest/min `v1.0.13`, `update_required=true`
- Windows `current=v1.0.13` -> `update_required=false`
- macOS `current=v1.0.8` -> `update_required=false`

## Safety

- No paid AI/provider generation call was made in the Windows verification.
- No Naver publish/save/draft action was performed.
- No customer data, passwords, cookies, API keys, `.env`, browser profiles, setup links, signed URLs, or raw private logs were used in returned artifacts.

## Residual Risk

- The Windows installer is unsigned because no code-signing certificate was available in the Windows build environment. SmartScreen or enterprise policy may still warn or block unsigned installers.
- Real successful account login was not performed in the Windows pass by design; the login path was verified with fake/no-op clients to avoid handling credentials.

