# Oracle Deploy 20260521 macOS v1.0.9 Local Settings UX

## Summary

Deployed macOS AIMAX Local Agent `v1.0.9` for local security settings UX and credential persistence hardening.

## Fix

- Local security settings dialog is now resizable and scrollable, with Save/Cancel always available on smaller screens.
- Web dashboard local-settings command polling is faster:
  - command polling defaults to 5 seconds
  - heartbeat remains independently throttled
- The dashboard button now shows "설정 창 여는 중..." and explains that the window normally opens within 5 seconds.
- Existing secrets can be recovered from environment/fallback/legacy keychain paths without exposing values in logs.
- Empty secret fields saved by the user now clear local fallback values and block automatic resurrection from legacy storage.
- Damaged legacy base64 password fields no longer crash settings loading.
- Added an API key guide link in the local settings dialog and legacy settings tab.
- Created Notion API key guide page:
  - `https://www.notion.so/367b31f1da5581ed9b11f23757476cd2`

## Verification

- `venv/bin/python -m py_compile app.py split_version/app.py local_agent/runtime.py aimax_compliance.py split_version/aimax_compliance.py`: passed
- Secret clear / legacy decode safety smoke: `SETTINGS_SECRET_CLEAR_AND_LEGACY_SAFETY_OK`
- Env-to-fallback recovery smoke with masked output: `RECOVERY_ENV_TO_FALLBACK_MASKED_OK`
- Static local-settings UX guard: passed
- `codesign --verify --deep --strict dist/AIMAX.app`: passed
- `hdiutil verify dist/AIMAX-macos.dmg`: VALID
- Frozen diagnostics probe:
  - `version`: `v1.0.9`
  - `version_label`: `AIMAX v1.0.9`
  - `ai_text_import_smoke.ok`: `true`

## Artifact

- Local: `dist/upload_installers/aimax-bundle-macos.dmg`
- Remote: `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`
- SHA256: `5d4d25bfcc81c58cd5ecd5c830bfeaa3f4f783a1bdcf969d0fa2d06bd78b004b`

## Backups

- `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg.v1.0.8.backup-20260521-v109-local-settings-ux`
  - SHA256: `146ed877c5d67c7b0b62d1a3f1354bacb983dd3840406ae4b9dc92b030cdcf2f`
- `/home/ubuntu/aimax-reports-api/.env.bak-20260521-v109-local-settings-ux`
- `/home/ubuntu/aimax-reports-api/static/app.html.bak-20260521-v109-local-settings-ux`

## Version API

- macOS `current=v1.0.8` -> latest/min `v1.0.9`, `update_required=true`
- macOS `current=v1.0.9` -> `update_required=false`
- Windows `current=v1.0.13` -> `update_required=false`

## Safety

- No paid AI generation call was made.
- No Naver publish/save/draft action was performed.
- Secret recovery tests used masked boolean assertions only after the initial environment was cleared.
