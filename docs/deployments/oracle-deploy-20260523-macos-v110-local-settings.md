# Oracle Deploy 20260523 macOS v1.0.10 Local Settings

- date: `2026-05-23 KST`
- scope: macOS bundle installer + macOS agent version env only
- Windows installer/version: not changed, remains `v1.0.16`
- paid/API/Naver tests: not run

## Root Cause

The Mac browser was showing a Windows runner version because server-side agent state had been stored and fetched by `user_id` only. When the same account used Windows and Mac runners, the latest Windows heartbeat could overwrite the Mac status shown in the Mac browser.

## Fixes Already Deployed To Web

- Agent status lookup now uses user + platform/device selection.
- Web calls `/api/agent/status?platform=...`.
- Local runners poll commands with platform information.
- `open_settings` and local key import commands can be platform-targeted.

## macOS v1.0.10 Build

- `aimax_compliance.py`: `APP_VERSION = "v1.0.10"`
- `split_version/aimax_compliance.py`: `APP_VERSION = "v1.0.10"`
- `local_agent/runtime.py`: web-opened local security settings now shows only Naver ID/password and preserves existing local AI/API keys.
- `app.py`, `split_version/app.py`: web `open_settings` command opens the simplified local security settings dialog instead of the full employee settings panel.

## Local Validation

- `python -m py_compile app.py split_version/app.py local_agent/runtime.py web_agent/client.py aimax_compliance.py split_version/aimax_compliance.py`
- `node --check oracle/aimax-reports-api/server.js`
- `node --check scripts/smoke_local_secret_import.mjs`
- `node scripts/smoke_local_secret_import.mjs`
  - Result: `LOCAL_SECRET_IMPORT_SMOKE_OK`
- `venv/bin/python build.py`
- `plutil -p dist/AIMAX.app/Contents/Info.plist`
  - `CFBundleShortVersionString`: `1.0.10`
  - `CFBundleVersion`: `1.0.10`
- `dist/AIMAX.app/Contents/MacOS/AIMAX --diagnostics-probe /private/tmp/aimax_v110_diag.json`
  - `system.app.version`: `v1.0.10`
  - `system.runtime.frozen`: `true`
  - `ai_text_import_smoke.ok`: `true`
- `codesign --verify --deep --strict dist/AIMAX.app`
- `hdiutil verify dist/AIMAX-macos.dmg`
  - Result: checksum valid

## Artifact

- Local upload file: `dist/upload_installers/aimax-bundle-macos.dmg`
- SHA256: `403cb830a6ff2055e1869801794d0dd6cf80528b841823b8f6de670b86899906`
- Previous macOS bundle backup:
  - `dist/upload_installers/archive-macos-20260523-pre-v110-local-settings/aimax-bundle-macos.dmg`

## Remote Deployment

- Remote installer path: `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`
- Remote backup path: `/home/ubuntu/aimax-backups/20260523-macos-v110-local-settings/`
- Service: `aimax-reports-api.service`
- Service status after restart: `active`
- Remote SHA256:
  - `403cb830a6ff2055e1869801794d0dd6cf80528b841823b8f6de670b86899906  /home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`

## Live Verification

- `GET /api/version?platform=macos&current=v1.0.9`
  - latest/min: `v1.0.10`
  - `update_required`: `true`
  - release notes shortened to user-facing action copy:
    - `macOS 실행기 업데이트가 필요합니다. 실행기 연결과 로컬 설정 열기 흐름을 더 안정적으로 개선했습니다. 설치 후 실행기를 다시 연결해주세요.`
- `GET /api/version?platform=macos&current=v1.0.10`
  - latest/min: `v1.0.10`
  - `update_required`: `false`
- `GET /api/version?platform=windows&current=v1.0.15`
  - latest/min: `v1.0.16`
  - `update_required`: `true`
  - Windows release notes unchanged.

## Residual Risk

- Windows must still be checked separately because its installer has its own packaged local runner UI. A Windows handoff was prepared for platform-specific verification and, if needed, a `v1.0.17` rebuild.
- The full product key contract is not finished yet: Blog Team local generation still uses local AI keys. The simplified web-opened local settings avoids user confusion but does not remove the old in-app employee settings panel.
