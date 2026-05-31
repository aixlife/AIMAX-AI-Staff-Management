# macOS Build 20260525 v1.0.11 R3-C Artifact Consumer

- date: `2026-05-25 KST`
- scope: macOS local runner rebuild for R3-C Yeri Local Artifact Consumer
- deployment: not uploaded to Oracle yet
- paid/API/Naver tests: not run

## Purpose

Build the macOS installer that contains the R3-C local artifact consumer changes:

- `yeri_write` jobs with `artifact.content_markdown` skip local AI text generation.
- Local runner starts from artifact parsing/editor input path.
- Server claim remains gated by `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED`.

## Build

Command:

```text
venv/bin/python build.py
```

First sandboxed attempt failed because PyInstaller needed to remove its cache under:

```text
~/Library/Application Support/pyinstaller
```

The same command was rerun with filesystem approval and completed successfully.

## Version

Source:

```text
aimax_compliance.py: APP_VERSION = "v1.0.11"
split_version/aimax_compliance.py: APP_VERSION = "v1.0.11"
```

Bundle metadata:

```text
CFBundleShortVersionString = 1.0.11
CFBundleVersion = 1.0.11
CFBundleIdentifier = kr.makefamily.aimax
CFBundleURLSchemes = aimax
```

## Validation

Commands:

```text
plutil -p dist/AIMAX.app/Contents/Info.plist
codesign --verify --deep --strict dist/AIMAX.app
hdiutil verify dist/AIMAX-macos.dmg
dist/AIMAX.app/Contents/MacOS/AIMAX --diagnostics-probe /private/tmp/aimax_r3c_v111_diag.json
```

Results:

```text
codesign verify: pass
hdiutil verify: checksum valid
diagnostics system.app.version: v1.0.11
diagnostics system.runtime.frozen: true
diagnostics ai_text_import_smoke.ok: true
```

Note: diagnostics probe did not run paid API calls. It included old local app log excerpts from previous user activity; those were not new requests from this build validation.

## Artifact

Local package:

```text
dist/AIMAX-macos.dmg
```

Staged upload file:

```text
dist/upload_installers/aimax-bundle-macos.dmg
```

SHA256:

```text
1a746f909d973a6442bd813a78ed4e3f17972652b9a6f3c0e6539e6f2d071b38  dist/upload_installers/aimax-bundle-macos.dmg
```

Previous macOS bundle backup:

```text
dist/upload_installers/archive-macos-20260525-pre-v111-r3c-artifact-consumer/aimax-bundle-macos.dmg
```

## Release Gate

Do not deploy/activate R3-C yet.

Required before production activation:

1. Windows Codex must rebuild and return Windows `v1.0.18` installer.
2. Mac `v1.0.11` and Windows `v1.0.18` installers must be uploaded to Oracle.
3. Version API must require those versions per platform.
4. Only after both OS installers are available should `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1` be considered.
5. Real paid server generation still requires separate explicit approval.

