# AIMAX Mac Runner Install Check - v1.0.11

Date: 2026-05-25

## Summary

The installed macOS AIMAX app at `/Applications/AIMAX.app` was still `v1.0.10`, while the current built runner in `dist/AIMAX.app` was `v1.0.11`.

The server requires `v1.0.11` for macOS:

- `current=v1.0.10`: `update_required=true`
- `current=v1.0.11`: `update_required=false`

This explains the update popup / reconnect loading loop when the web app opened the macOS URL handler, because the handler was launching the old installed app.

## Action

Replaced `/Applications/AIMAX.app` with the current `dist/AIMAX.app` build and re-registered LaunchServices for the app.

Backup preserved:

`/Applications/AIMAX.app.v1.0.10.backup-20260525-2352`

## Verification

- `/Applications/AIMAX.app/Contents/Info.plist`: `1.0.11`
- Diagnostics probe: `/Applications/AIMAX.app/Contents/MacOS/AIMAX` reports `v1.0.11`
- `codesign --verify --deep --strict /Applications/AIMAX.app`: passed
- Server version check for `current=v1.0.11`: `update_required=false`

## Safety Notes

No AIMAX process was running at install time. No job was created, claimed, or executed by this check.

While Claude was working on the Mac Naver editor-entry issue, Codex only changed the installed app version and did not start the runner or consume any job.
