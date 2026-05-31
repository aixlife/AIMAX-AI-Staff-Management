# Oracle Deploy 20260521 macOS v1.0.6 Keychain Fallback

## Scope

Deployed macOS AIMAX Local Agent `v1.0.6` to reduce repeated macOS Keychain prompts and support environments where the OS credential store is unavailable or denied.

## Fixes

- Web agent session token now has a local `0600` fallback file under the AIMAX user data directory.
- Settings secrets now have a local `0600` fallback file under the AIMAX user data directory.
- Secret load order uses fallback first, then keychain only when needed.
- On macOS, automatic keychain access is opt-in via `AIMAX_ENABLE_KEYCHAIN=1`; default runs use the local fallback to avoid repeated Keychain permission dialogs.
- Keychain denial/timeout marks keychain unavailable to reduce repeated permission prompts.
- Web app password input trims leading/trailing whitespace in GUI/headless connect paths.
- `invalid_credentials` now explains that copied password whitespace can cause failure.

## Local Verification

- `python -m py_compile web_agent/client.py app.py local_agent/runtime.py split_version/app.py aimax_compliance.py split_version/aimax_compliance.py`
- No-keychain fallback tests:
  - `APP_SECRET_FALLBACK_NO_KEYCHAIN_OK`
  - `SPLIT_SECRET_FALLBACK_NO_KEYCHAIN_OK`
  - `WEB_SESSION_FALLBACK_NO_KEYCHAIN_OK`
- DMG verification: `hdiutil verify dist/AIMAX-macos.dmg` -> VALID
- Installed app probe:
  - `INSTALLED_VERSION v1.0.6`
  - `INSTALLED_AI_TEXT_IMPORT_OK True`
- `codesign --verify --deep --strict` passed for the built and installed app.

## Artifact

- Local: `dist/upload_installers/aimax-bundle-macos.dmg`
- SHA256: `4db6701fc3d1bcf3b83cf39fca08eb8e7311996639a329cfcb13ee81bc11d402`

## Oracle

- Uploaded to `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`.
- Previous v1.0.5 backup:
  - `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg.v1.0.5.backup-20260521-v106-keychain-fallback`
- Pre keychain opt-in v1.0.6 backup:
  - `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg.v1.0.6.pre-keychain-optin.backup-20260521`
- `.env` backup:
  - `/home/ubuntu/aimax-reports-api/.env.bak-20260521-v106-keychain-fallback`
- User service restarted:
  - `systemctl --user restart aimax-reports-api.service`

## Version API

- macOS `current=v1.0.5` -> latest/min `v1.0.6`, `update_required=true`
- macOS `current=v1.0.6` -> `update_required=false`
- Windows `current=v1.0.12` remains latest/min `v1.0.12`, `update_required=false`

## Windows Follow-Up

Prepared a Windows v1.0.13 handoff for the same credential fallback logic:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-v113-keychain-fallback/`
