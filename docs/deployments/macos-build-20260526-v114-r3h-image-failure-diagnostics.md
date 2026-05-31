# Mac Build 20260526 v1.0.14 R3-H Image Failure Diagnostics

Date: 2026-05-26 KST

## Scope

Built a macOS candidate for R3-H. This is a local/staged build only; no Oracle live deployment was performed in this step.

## Version

```text
APP_VERSION: v1.0.14
Bundle version: 1.0.14
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
dist/upload_installers/archive-macos-20260526-pre-v114-r3h-image-failure-diagnostics/aimax-bundle-macos.dmg
```

## Verification

```text
codesign --verify --deep --strict dist/AIMAX.app
pass

hdiutil verify dist/AIMAX-macos.dmg
checksum valid

dist/AIMAX.app/Contents/MacOS/AIMAX --diagnostics-probe /private/tmp/aimax_r3h_v114_frozen_diag.json
version: v1.0.14
frozen runtime: true
ai_text_import_smoke.ok: true
```

## SHA256

```text
6a99813dcb98ed52b38edf51a4bea01786dcbceb0d991d941c73da5beef6c0e6  dist/upload_installers/aimax-bundle-macos.dmg
333a8fce6ae2662faea919c0ec0fb3a391e67caec99fcb43b6ee09fbb7c65d71  dist/upload_installers/archive-macos-20260526-pre-v114-r3h-image-failure-diagnostics/aimax-bundle-macos.dmg
```

## Safety

- No paid AI call.
- No Apify call.
- No Naver publish/schedule/edit/save mutation.
- No customer credentials.
- No live version API update yet.

## Next

Wait for Windows R3-H `v1.0.23` result, then prepare Mac `v1.0.14` + Windows `v1.0.23` rollout checklist.
