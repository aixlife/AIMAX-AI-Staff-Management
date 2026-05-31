# Oracle Deploy 2026-05-14 13:42 KST - macOS Bundle Unavailable Fix

## Scope

- Rebuilt macOS 통합 `AIMAX.app` from current `app.py`.
- Added stable macOS bundle metadata to `AIMAX.spec`:
  - `CFBundleShortVersionString=1.0.2`
  - `CFBundleVersion=1.0.2`
  - `CFBundleIdentifier=kr.makefamily.aimax`
  - `aimax://` URL scheme.
- Recreated `dist/upload_installers/aimax-bundle-macos.dmg`.
- Replaced only `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`.

## Backup

- Previous operating file:
  - `/home/ubuntu/aimax-downloads/archive-macos-20260514-1342-pre-bundle-unavailable-fix/aimax-bundle-macos.dmg`

## SHA-256

- New operating bundle DMG:
  - `aa5dbdc9d90301c59787c95d1cd4eb84c3239ec49efd6c7141de8020cae012d7`
- Previous operating bundle DMG:
  - `8f6aed3943fa36ce26f7ab334a399b19ca47b8e4d3ccf0434e14c9cc57bc3656`

## Verification

- `venv/bin/pyinstaller --clean --noconfirm AIMAX.spec` completed.
- `codesign --verify --deep --strict dist/AIMAX.app` passed.
- `hdiutil verify dist/upload_installers/aimax-bundle-macos.dmg` passed.
- Mounted DMG and verified embedded `AIMAX.app/Contents/Info.plist` contains version `1.0.2` and `aimax://` scheme.
- Demo source heartbeat smoke showed:
  - `demo@aimax.ai.kr`
  - product `bundle`
  - workers `yeri_write=ready`, `hyunju_find=ready`
- `/api/downloads/options` for demo shows macOS bundle exists with size `65460137`.

