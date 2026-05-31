# Oracle Deploy 20260521 macOS v1.0.7 Login IME Guard

## Summary

Deployed macOS AIMAX Local Agent `v1.0.7` and server-side password setup hotfixes for web-account login confusion caused by Korean IME/password input mismatch.

## Changes

- Server `/setup` password page:
  - Added password confirmation field.
  - Rejects password mismatch.
  - Rejects leading/trailing whitespace.
  - Rejects non-visible/non-ASCII characters, including Korean IME input.
- Server `validateNewPassword()`:
  - Adds `password_has_outer_whitespace`.
  - Adds `password_requires_ascii`.
- Local Agent:
  - Adds `password_input_error()` in `web_agent/client.py`.
  - Blocks Hangul/non-ASCII/outer-space web password input before login HTTP request.
  - Clears rejected password input.
  - Shows Korean/English input-mode hint when password field receives focus.
  - Keeps macOS keychain opt-in and fallback session storage from `v1.0.6`.

## Verification

- `node --check oracle/aimax-reports-api/server.js`: passed
- `python -m py_compile web_agent/client.py app.py split_version/app.py local_agent/runtime.py aimax_compliance.py split_version/aimax_compliance.py`: passed
- Local password guard smoke: `WEB_PASSWORD_INPUT_GUARD_OK`
- Server/setup guard smoke: `SETUP_PASSWORD_ASCII_CONFIRM_GUARD_OK`
- `codesign --verify --deep --strict dist/AIMAX.app`: passed
- `hdiutil verify dist/AIMAX-macos.dmg`: VALID
- Installed app version: `1.0.7`
- Installed headless smoke with saved session: connected to web app and waited for work

## Artifact

- Local: `dist/upload_installers/aimax-bundle-macos.dmg`
- Remote: `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`
- SHA256: `153db5716b5b06b8bf997148f66cd70027fb6fa5459dee2cf813e55e44713015`

## Backups

- `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg.v1.0.6.backup-20260521-v107-ime-guard`
  - SHA256: `4db6701fc3d1bcf3b83cf39fca08eb8e7311996639a329cfcb13ee81bc11d402`

## Version API

- macOS `current=v1.0.6` -> latest/min `v1.0.7`, `update_required=true`
- macOS `current=v1.0.7` -> `update_required=false`
- Windows `current=v1.0.12` -> `update_required=false`

## Windows Follow-Up

Windows local app should receive the same password-field guard as `v1.0.13`.

Shared-Bridge handoff:

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-v113-login-ime-guard`

