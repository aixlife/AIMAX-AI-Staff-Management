# Mac Build 20260526 v1.0.15 R3-I Keychain Hang Hotfix

Date: 2026-05-26 KST

## Scope

Built a macOS candidate for R3-I. This is a local/staged build only; no Oracle live deployment was performed in this step.

## Trigger

Latest Mac report:

```text
AIMAX-RPT-20260526043826-00f312ea
Platform: macOS
App version: v1.0.13
Issue: Naver password save/local settings screen hangs; hang report points to UI-thread blocking wait.
```

## Fix

- Added timeout to Keychain writes/deletes via `AIMAX_KEYCHAIN_WRITE_TIMEOUT_SECONDS` default `2`.
- If Keychain write hangs, the app marks Keychain unavailable for the session instead of freezing.
- Web-requested local security settings save now runs in a background thread.
- The settings dialog remains responsive while saving and shows a saving status.
- Fallback local secret storage is still written before Keychain, so entered settings are preserved even if Keychain stalls.
- Background save completion is returned to Tk through a main-loop polling queue instead of calling Tk from the worker thread.
- The local security settings dialog now supports `Enter` to save and `Escape` to cancel.
- The headless settings dialog no longer relies on Tk `StringVar` for field/status values, avoiding terminal-visible Tk cleanup warnings after save.

## Version

```text
APP_VERSION: v1.0.15
Bundle version: 1.0.15
```

## Build

```text
venv/bin/python build.py
```

Output:

```text
dist/AIMAX.app
dist/AIMAX-macos.dmg
dist/upload_installers/aimax-bundle-macos.dmg
```

Previous local staged DMG was archived:

```text
dist/upload_installers/archive-macos-20260526-pre-v115-r3i-keychain-hang-hotfix/aimax-bundle-macos.dmg
dist/upload_installers/archive-macos-20260526-pre-v115-r3i-enter-save-hotfix/aimax-bundle-macos.dmg
dist/upload_installers/archive-macos-20260526-pre-v115-r3i-final-tk-cleanup/aimax-bundle-macos.dmg
```

## Verification

```text
venv/bin/python -m py_compile app.py split_version/app.py local_agent/runtime.py
pass

codesign --verify --deep --strict dist/AIMAX.app
pass

hdiutil verify dist/AIMAX-macos.dmg
checksum valid

dist/AIMAX.app/Contents/MacOS/AIMAX --diagnostics-probe /private/tmp/aimax_r3i_v115_final_diag.json
version: v1.0.15
frozen runtime: true
ai_text_import_smoke.ok: true

Actual open-settings save flow:
command id: b6fe8675-6271-49aa-a79a-58ead9bc3719
command status: done
runner after save: connected, v1.0.15, update_required=false
```

## SHA256

```text
900af3671bdc322c29297fca3f1294806bf0ae0cefb156e54c7682dcf3415878  dist/upload_installers/aimax-bundle-macos.dmg
802fec33605124945491009653ffdf19996b1a3d34115c760102bab07b8296d5  dist/upload_installers/archive-macos-20260526-pre-v115-r3i-final-tk-cleanup/aimax-bundle-macos.dmg
ae79a52db395d6c43a68cf0beb3a20276ead08351c94ed4ff5874691d96220b0  dist/upload_installers/archive-macos-20260526-pre-v115-r3i-enter-save-hotfix/aimax-bundle-macos.dmg
6a99813dcb98ed52b38edf51a4bea01786dcbceb0d991d941c73da5beef6c0e6  dist/upload_installers/archive-macos-20260526-pre-v115-r3i-keychain-hang-hotfix/aimax-bundle-macos.dmg
```

## Safety

- No paid AI call.
- No Apify call.
- No Naver publish/schedule/edit/save mutation.
- No customer credentials.
- No live version API update yet.

## Windows Handoff

Windows R3-I handoff was prepared because the latest Windows report indicates stale old-runner/update recognition loop:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3i-runner-liveness-update-fix
```

Expected Windows target:

```text
v1.0.24
```

## Next

Windows R3-I `v1.0.24` has passed and the Mac actual open-settings save flow has passed.
Live deployment remains paused until the user explicitly approves rollout after the full actual-test gate.
