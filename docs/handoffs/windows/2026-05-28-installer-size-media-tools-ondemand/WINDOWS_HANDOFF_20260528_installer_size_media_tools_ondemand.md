# AIMAX Windows Handoff - Installer Size / Media Tools On-Demand

Date: 2026-05-28 KST

## Purpose

Continue the agreed safe sequence:

1. Archive cleanup
2. Size report automation
3. PyInstaller `collect-all` reduction
4. pandas removal
5. Windows media-tools on-demand

This handoff is for step 5 and Windows-side verification of steps 3-4. Do not deploy, upload to Oracle, or change the version API from this task.

## Mac-Side Results Already Verified

- Archive cleanup: `dist/upload_installers` archive folders reduced from 32 to 10, freeing about 2.3GB. Current upload files were not deleted.
- Size report automation added:
  - `scripts/installer_size_report.py`
  - `docs/maintenance_reports/aimax_installer_size_report_20260528.md`
  - `docs/maintenance_reports/aimax_installer_size_report_20260528.json`
- PyInstaller optimized collect experiment:
  - baseline current `dist/AIMAX`: 118.3MB
  - collect-reduced temp build: 108.9MB
  - pandas-free temp build: 78.6MB
  - frozen diagnostics passed with `ai_text_import_smoke.ok=true` and `excel_loader_import_smoke.ok=true`
- pandas removal:
  - Excel bulk loading now uses `openpyxl` via `bulk/excel_loader.py`
  - `scripts/smoke_excel_loader_no_pandas.py` passed
  - source search over `app.py`, `split_version/app.py`, `bulk/*.py` showed no pandas use
- Error report context smoke passed after media-tools missing diagnostics were added:
  - `ERROR_REPORT_CONTEXT_SMOKE_OK`

## Source Changes To Carry To Windows

Use the supplied source bundle or mirror files in this folder. Important changed files:

- `build.py`
- `split_version/build_split.py`
- `app.py`
- `split_version/app.py`
- `bulk/excel_loader.py`
- `bulk/excel_runner.py`
- `scripts/cleanup_installer_archives.py`
- `scripts/installer_size_report.py`
- `scripts/pyinstaller_collect_experiment.py`
- `scripts/smoke_excel_loader_no_pandas.py`
- `scripts/smoke_error_report_context.mjs`
- `scripts/fetch_windows_media_tools.ps1`
- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `oracle/aimax-reports-api/static/admin.html`
- `oracle/aimax-reports-api/vendor/media-tools/README.md`

## Implementation Notes

- Production PyInstaller config now keeps `--collect-all=ttkbootstrap`, but changes `undetected_chromedriver`, `google.genai`, and `anthropic` to `--collect-submodules`.
- Production PyInstaller config now excludes dev/heavy modules including `pandas` and `numpy`.
- `scripts/fetch_windows_media_tools.ps1` now defaults to user on-demand install:
  - `%LOCALAPPDATA%\AIMAX\media-tools\win32\x64`
  - use `-InstallScope Repo` only for an intentional repo-local/bundled test
- The reports API now searches media tools dynamically in:
  - explicit `AIMAX_SONGI_YTDLP_PATH` / `AIMAX_SONGI_FFMPEG_PATH`
  - `AIMAX_MEDIA_TOOLS_DIR`
  - user on-demand cache
  - bundled fallback directory
  - `PATH`
- Do not make paid Gemini or Apify calls during this task.

## Windows Tasks

1. Read this handoff and the copy-paste prompt first.
2. Copy the supplied source out of Syncthing into a normal local Windows work folder. Do not build inside Syncthing/shared folders.
3. Keep secrets, `.env`, passphrases, customer credentials, browser cookies, and paid-provider keys out of Syncthing.
4. Apply/update the listed source files.
5. Run no-paid source checks:
   - `python -m py_compile app.py split_version/app.py bulk/excel_loader.py bulk/excel_runner.py scripts/smoke_excel_loader_no_pandas.py`
   - `python scripts/smoke_excel_loader_no_pandas.py`
   - search only source folders for pandas use, excluding `venv`, `build`, and `dist`
6. Build Windows onedir with the production build script.
7. Inspect `dist/AIMAX/_internal`:
   - confirm `pandas` and `numpy` are not included
   - record top size contributors
8. Confirm Windows media tools are not bundled into the installer by default:
   - no `vendor/media-tools/win32/x64/*.exe` in source payload or installer source unless explicitly testing repo-local bundling
9. Build the Inno installer.
10. Record installer file size and SHA256.
11. Run installed-user verification:
   - install from the built installer
   - launch the installed runner
   - connect from the real web UI/test account
   - verify the dashboard recognizes the installed runner and version
12. Verify missing media-tools behavior without paid calls:
   - Songi/YouTube flow should show the existing missing `yt-dlp/ffmpeg` warning or diagnostics
   - no crash, no automatic paid Gemini/Apify execution, no automatic media download
13. Verify on-demand media-tools install:
   - run `scripts\fetch_windows_media_tools.ps1` with no args
   - confirm install path is `%LOCALAPPDATA%\AIMAX\media-tools\win32\x64`
   - confirm `manifest.json` exists and contains versions/SHA256
   - restart or refresh the relevant server/runner status and confirm media tool status flips to available
14. Submit or simulate a no-secret error report with missing media-tools context and confirm admin summary includes `media_tools_missing`.

## Return Artifacts

Return these to the same Syncthing folder:

- `WINDOWS_RESULT_20260528_installer_size_media_tools_ondemand.md`
- Built `aimax-bundle-windows.exe` only if all no-paid gates pass
- SHA256 and size report
- PyInstaller size/top-contributor report
- Smoke logs
- Screenshots or visible text evidence for installed-user flow
- On-demand `manifest.json` from `%LOCALAPPDATA%\AIMAX\media-tools\win32\x64`
- Blocker report if any gate fails

## Stop Conditions

Stop and report blockers if any of these happen:

- installed runner cannot launch or connect from the real web UI
- installer opens invisibly, hangs, or cannot produce an Inno log
- pandas or numpy is included after the optimized build
- media tools are still bundled into the default installer
- Songi flow makes a paid API call without explicit approval
- error report leaks secrets, signed URLs, API keys, tokens, or customer credentials
- Windows behavior diverges from macOS in a user-visible way that affects existing users
