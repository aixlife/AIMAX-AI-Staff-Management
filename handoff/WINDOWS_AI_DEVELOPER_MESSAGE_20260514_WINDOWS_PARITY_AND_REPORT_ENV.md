# Windows AI Developer Message - 2026-05-14 Windows Parity + Error Report Environment

Audience: Windows AI developer

## Why this exists

Mac/Oracle side fixed several production issues on 2026-05-14. The web server changes are deployed from Mac, but Windows EXE files in `dist/upload_installers` are still dated 2026-05-07 and should be treated as stale until rebuilt from current source.

## Must rebuild on Windows

Use the sanitized source ZIP in this Syncthing folder, copy it to a local Windows work folder, then rebuild all three Windows installers:

- `aimax-current-source-20260514-windows-parity-report-env.zip`
- `aimax-current-source-20260514-windows-parity-report-env.sha256`

- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`

The Windows build must include these current-source changes:

- `app.py` and `split_version/app.py` image-count hotfix:
  - If a Yeri write job requests images, but fewer image prompts/attachments are produced than requested, the local worker must fail the job instead of reporting `done`.
  - Do not run paid image-generation tests. Use stubs or fake input content.
- Current Local Agent readiness behavior:
  - Bundle build should report `yeri_write=ready` and `hyunju_find=ready` when Naver + selected AI key + neighbor messages are ready.
  - Split builds may report the unsupported worker as `unavailable`, but bundle must not.
- Error report diagnostics:
  - Desktop error reports should include `system.app`, `system.runtime`, `driver`, logs, traceback, debug file list through `diagnostics/error_reporter.py` and `diagnostics/system_info.py`.
  - Verify on Windows that `system.runtime.system` is `Windows`, `frozen` is true for the built EXE, and no secrets are exposed.

## Web-side change already handled on Oracle

The Oracle web app now sends richer web error-report context:

- OS/browser/platform
- viewport and screen size
- timezone
- current URL
- Local Agent connected/status/version/platform/device label/readiness

Admin report copy text now includes:

- `앱/OS`
- `브라우저`
- `실행기`

No Windows web deployment is needed for those files, but Windows EXE rebuilds are still needed for local desktop worker behavior.

## Validation required before returning artifacts

1. Run static checks:
   - Python compile for changed modules.
   - PyInstaller build warnings reviewed.
2. Run fake/stubbed Yeri image-count test:
   - request `image_count > 0`
   - simulate too few generated images
   - expect failed job update, not done.
3. Run heartbeat-only smoke:
   - no queued command/job consumption
   - no paid generation
   - reports `version: v1.0.2`
   - bundle readiness has both workers ready under ready settings.
4. Confirm Inno installer metadata:
   - `AppVersion=1.0.2`
   - `aimax://` protocol registration still points to `AIMAX.exe --agent "%1"`.
5. Return:
   - rebuilt EXEs
   - SHA-256 for each
   - completion report with exact source commit/folder, tests, and any warnings.
