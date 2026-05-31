# Oracle Deploy 2026-05-18 13:20 KST - macOS Unified Bundle Rebuild

## Scope

- Rebuilt macOS unified `AIMAX.app` from the current project source.
- Replaced only `/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg`.
- Did not redeploy Windows installers from local `dist/upload_installers` because local Windows files are older than the operating Oracle `v1.0.5` installers.
- Added defensive Keychain read timeout so a newly rebuilt macOS app cannot silently hang while waiting for old Keychain permission.
- Updated `build.py` to write generated PyInstaller specs under `build/` and use absolute data paths so the maintained `AIMAX.spec` is not overwritten during normal builds.
- Updated maintained `AIMAX.spec` so manual spec builds point at this project source instead of the old `NaverBlogAuto-main-mac` path.

## Remote Backup

- `/home/ubuntu/aimax-downloads/archive-macos-20260518-pre-unified-keychain-timeout/aimax-bundle-macos.dmg`

## SHA-256

- New macOS bundle:
  - `090b679e4c1f9ecc7e4bf31773f71288c95ef4dbb95fed7f15acfd069eded161`
- Previous macOS bundle backup:
  - `aa5dbdc9d90301c59787c95d1cd4eb84c3239ec49efd6c7141de8020cae012d7`
- Operating Windows bundle remained unchanged on Oracle:
  - `ccd07ee0ced0af09fd890271710a132517503d9afd59fe2007720b0f3d2ead77`

## Verification

- `python3 -m py_compile app.py web_agent/client.py build.py AIMAX.spec` passed.
- `venv/bin/python build.py` completed.
- Packaged diagnostics probe:
  - `version=v1.0.5`
  - `mode=all`
  - `frozen=true`
  - `ai_text_import_smoke.ok=true`
  - `sample_visible_char_count=13`
- `codesign --verify --deep --strict dist/AIMAX.app` passed.
- `hdiutil verify dist/AIMAX-macos.dmg` passed.
- Packaged one-shot headless run no longer hangs when old Keychain session is unavailable:
  - `AIMAX Local Agent headless mode started.`
  - `[웹앱 연결] 저장된 웹앱 세션이 없습니다. 웹앱에서 연결/페어링이 필요합니다.`
- Source one-shot heartbeat using the existing local session confirmed demo account readiness:
  - `demo@aimax.ai.kr`
  - `version=v1.0.5`
  - `workers.yeri_write=ready`
  - `workers.hyunju_find=ready`
- Public health passed:
  - `GET /api/reports/health` -> `ok=true`
- macOS version API remains non-blocking:
  - `current=v1.0.5, platform=macos` -> `update_required=false`
  - `current=v1.0.2, platform=macos` -> `update_required=false`

## Windows Follow-Up

Windows handoff folder:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/AIMAX-20260518-unified-launcher-guard/`

Shared files:

- `WINDOWS_AI_DEVELOPER_MESSAGE_20260518_UNIFIED_LAUNCHER_GUARD.md`
- `WINDOWS_AI_COPYPASTE_PROMPT_20260518_UNIFIED_LAUNCHER_GUARD.md`
- `aimax-unified-launcher-guard-source-20260518.zip`
- `aimax-unified-launcher-guard-source-20260518.zip.sha256`

Windows target remains `v1.0.6`: prevent split executables from silently serving bundle accounts, preserve `aimax://agent/connect` ownership/forwarding to the unified launcher, and return rebuilt Windows installers plus evidence.
