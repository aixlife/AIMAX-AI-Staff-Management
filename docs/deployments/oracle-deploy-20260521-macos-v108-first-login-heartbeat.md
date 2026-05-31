# Oracle Deploy 20260521 macOS v1.0.8 First Login Heartbeat

## Summary

Deployed macOS AIMAX Local Agent `v1.0.8` to remove the first-login "infinite loading" impression.

## Root Cause

After first web-account login, the Local Agent saved the session and then opened the local security settings dialog before starting web-agent polling/heartbeat. If that settings dialog stayed open or was hidden behind another window, the web dashboard could keep waiting for the agent and look like it was stuck loading.

## Fix

- Start web-agent polling immediately after successful first login.
- Open the local security settings dialog after polling starts.
- Keep `v1.0.7` guards:
  - Korean/IME password input blocked before login request.
  - Password confirmation and ASCII-only setup page.
  - macOS keychain opt-in and fallback session storage.

## Verification

- `python -m py_compile web_agent/client.py app.py split_version/app.py local_agent/runtime.py aimax_compliance.py split_version/aimax_compliance.py`: passed
- Password guard smoke: `V108_PASSWORD_GUARD_OK`
- `codesign --verify --deep --strict dist/AIMAX.app`: passed
- `hdiutil verify dist/AIMAX-macos.dmg`: VALID
- Installed headless smoke with saved session: connected to web app and waited for work

## Artifact

- Local: `dist/upload_installers/aimax-bundle-macos.dmg`
- Remote: `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`
- SHA256: `146ed877c5d67c7b0b62d1a3f1354bacb983dd3840406ae4b9dc92b030cdcf2f`

## Backups

- `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg.v1.0.7.backup-20260521-v108-first-login-heartbeat`
  - SHA256: `153db5716b5b06b8bf997148f66cd70027fb6fa5459dee2cf813e55e44713015`

## Version API

- macOS `current=v1.0.7` -> latest/min `v1.0.8`, `update_required=true`
- macOS `current=v1.0.8` -> `update_required=false`
- Windows `current=v1.0.12` -> `update_required=false`

