# Oracle Deploy 20260523 Windows v1.0.17 Cross Platform Local Settings

- date: `2026-05-23 KST`
- scope: Windows bundle installer + Windows agent version env only
- macOS installer/version: not changed, remains `v1.0.10`
- paid/API/Naver tests: not run

## Windows Return

Windows developer returned a rebuilt `v1.0.17` installer after checking that the Mac fix was not Mac-only.

Returned files:

- `WINDOWS_COMPLETION_20260523_cross_platform_local_settings.md`
- `aimax-bundle-windows.exe`
- `AIMAX-cross-platform-local-settings-windows-20260523.zip`
- `SHA256SUMS_cross_platform_local_settings.txt`

Reported installer SHA256:

- `5DF26513C9CD1E59FE20AEB8E023B7060180DB180EEA42055560606EE548C31D`

Local SHA256 after copying to `dist/upload_installers/aimax-bundle-windows.exe`:

- `5df26513c9cd1e59fe20aeb8e023b7060180db180eea42055560606ee548c31d`

Previous Windows bundle backup:

- `dist/upload_installers/archive-windows-20260523-pre-v117-cross-platform-local-settings/aimax-bundle-windows.exe`

## Windows Validation From Return Report

- `python -m py_compile .\app.py .\split_version\app.py .\local_agent\runtime.py .\web_agent\client.py` -> PASS
- `node --check .\oracle\aimax-reports-api\server.js` -> PASS
- app HTML embedded script syntax -> `APP_HTML_SCRIPT_SYNTAX_OK`
- `verify_v113_login_ime_guard.py` -> `V113_LOGIN_IME_GUARD_OK`
- `verify_v114_local_settings_ux.py` -> `V114_LOCAL_SETTINGS_UX_OK`
- `verify_v110_no_paid_editor_smoke.py` -> `V110_NO_PAID_EDITOR_SMOKE_OK`
- `scripts\smoke_local_secret_import.mjs` -> `LOCAL_SECRET_IMPORT_SMOKE_OK`
- installed `AIMAX.exe --diagnostics-probe` -> `version=v1.0.17`, `frozen=true`
- web-opened local settings static check -> `WEB_OPENED_LOCAL_SETTINGS_STATIC_OK`

## Remote Deployment

- Uploaded local file to `/tmp/aimax-bundle-windows-v117.exe`
- Remote installer path: `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
- Remote backup path: `/home/ubuntu/aimax-backups/20260523-windows-v117-cross-platform-local-settings/`
- Service: `aimax-reports-api.service`
- Service status after restart: `active`
- Remote SHA256:
  - `5df26513c9cd1e59fe20aeb8e023b7060180db180eea42055560606ee548c31d  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`

## Env Changes

- `AIMAX_WINDOWS_LATEST_AGENT_VERSION="v1.0.17"`
- `AIMAX_WINDOWS_MIN_AGENT_VERSION="v1.0.17"`
- `AIMAX_WINDOWS_AGENT_RELEASE_NOTES="Windows 실행기 업데이트가 필요합니다. 실행기 연결과 로컬 설정 열기 흐름을 더 안정적으로 개선했습니다. 설치 후 실행기를 다시 연결해주세요."`

macOS values were preserved:

- `AIMAX_MACOS_LATEST_AGENT_VERSION="v1.0.10"`
- `AIMAX_MACOS_MIN_AGENT_VERSION="v1.0.10"`

## Live Verification

- `GET /api/version?platform=windows&current=v1.0.16`
  - latest/min: `v1.0.17`
  - `update_available`: `true`
  - `update_required`: `true`
- `GET /api/version?platform=windows&current=v1.0.17`
  - latest/min: `v1.0.17`
  - `update_available`: `false`
  - `update_required`: `false`
- `GET /api/version?platform=macos&current=v1.0.10`
  - latest/min: `v1.0.10`
  - `update_available`: `false`
  - `update_required`: `false`
- `GET /api/reports/health`
  - `ok: true`

## Residual Risk

- Windows installer remains unsigned, so browser/SmartScreen warnings can still appear.
- No paid provider, Apify Actor, or real Naver save/publish test was run.
- GUI protocol behavior was validated by Windows smoke/static checks and installed diagnostics, not by live customer account automation.
