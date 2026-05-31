# AIMAX R3-F Release Rollout Plan

Date: 2026-05-26 KST

## Current Status

R3-F real E2E passed on both OS lanes:

- Mac: `v1.0.11` rebuilt locally with NID fix, real draft-save E2E passed
- Windows: `v1.0.21` installed runner, real draft-save E2E passed

## Why Mac Needs a Version Bump

The Mac fix was rebuilt under the already-used `v1.0.11` version. Existing users who already have `v1.0.11` may not be prompted to update.

Recommended Mac release version:

```text
v1.0.12
```

## Windows Release Candidate

Expected Windows release version:

```text
v1.0.21
```

Windows Codex handoff:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3f-release-rollout
```

Expected return files:

```text
WINDOWS_RESULT_20260526_r3f_release_rollout.md
aimax_r3f_v121_release_ready_diag.json
aimax-bundle-windows.exe
```

## Next Safe Gates

### Gate 1 - Windows Release Readiness

Wait for Windows result monitor to confirm:

- verdict pass
- release version `v1.0.21`
- final installer SHA256
- installed diagnostics pass
- no paid AI / Apify / Naver mutation during rollout-readiness task

### Gate 2 - Mac v1.0.12 Build

After Gate 1, prepare Mac release:

1. bump Mac-visible app version to `v1.0.12`
2. rebuild `dist/AIMAX.app`
3. rebuild `dist/AIMAX-macos.dmg`
4. install locally and verify:
   - diagnostics probe version `v1.0.12`
   - frozen runtime true
   - codesign verify pass
   - DMG verify pass
   - server version check for `current=v1.0.12` after deployment

### Gate 3 - Oracle Installer Upload

Upload:

- macOS: `aimax-bundle-macos.dmg`
- Windows: `aimax-bundle-windows.exe`

### Gate 4 - Version API Update

Expected live version requirements:

```text
macos latest/min: v1.0.12
windows latest/min: v1.0.21
```

### Gate 5 - Post-Deploy Checks

Mac:

- web version API says `v1.0.12` is current
- installed runner opens without update-required loop

Windows:

- Windows Codex verifies installed/update path sees `v1.0.21`
- no new paid job
- no Naver mutation

## Follow-up After Rollout

R3-G:

- add guard for empty image prompts before Smart Editor input or image insertion
- prevent paid image generation when prompt is empty
- choose one behavior:
  - regenerate prompt,
  - substitute safe default prompt,
  - or skip image insertion and mark sanitized stage result
