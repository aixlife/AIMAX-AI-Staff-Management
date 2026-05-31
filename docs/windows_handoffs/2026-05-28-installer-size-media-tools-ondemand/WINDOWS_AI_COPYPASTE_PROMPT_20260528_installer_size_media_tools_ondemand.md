You are the Windows AI developer for AIMAX.

First, read the latest handoff documents in this Syncthing folder:

- `WINDOWS_HANDOFF_20260528_installer_size_media_tools_ondemand.md`

Copy the supplied source out of Syncthing into a normal local Windows work folder before editing or building. Do not build inside the shared folder. Keep `.env`, API keys, passphrases, customer credentials, browser cookies, signed URLs, and paid-provider secrets out of Syncthing.

Goal: verify the safe installer-size optimization sequence on Windows, especially production PyInstaller collect reduction, pandas removal, and Windows media-tools on-demand. Do not deploy, upload to Oracle, or change the live version API.

Use or apply the supplied source files. Important changed files include:

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

Required no-paid checks:

1. Run Python compile checks:
   `python -m py_compile app.py split_version/app.py bulk/excel_loader.py bulk/excel_runner.py scripts/smoke_excel_loader_no_pandas.py`
2. Run:
   `python scripts/smoke_excel_loader_no_pandas.py`
3. Search source only, excluding `venv`, `build`, and `dist`, and confirm no pandas runtime use remains in `app.py`, `split_version/app.py`, or `bulk/*.py`.
4. Build Windows onedir with the production build script.
5. Inspect `dist\AIMAX\_internal`; confirm `pandas` and `numpy` are absent and record top size contributors.
6. Confirm default installer source does not include `vendor\media-tools\win32\x64\*.exe`.
7. Build the Inno installer and record size plus SHA256.
8. Install from the built installer, launch the installed runner, and verify from the real web UI/test account that the dashboard recognizes the runner and version.
9. Verify Songi/YouTube missing media-tools behavior without paid calls: it should warn or report missing `yt-dlp/ffmpeg`, continue safely where possible, and must not auto-run Gemini/Apify or auto-download tools.
10. Run `scripts\fetch_windows_media_tools.ps1` with no args. Confirm it installs into `%LOCALAPPDATA%\AIMAX\media-tools\win32\x64`, writes `manifest.json`, and records versions/SHA256.
11. Restart/refresh the relevant runner/server status and confirm media tools become available.
12. Submit or simulate a no-secret error report with missing media-tools context and confirm admin summary includes `media_tools_missing`.

Return to this same Syncthing folder:

- `WINDOWS_RESULT_20260528_installer_size_media_tools_ondemand.md`
- Built `aimax-bundle-windows.exe` only if all no-paid gates pass
- SHA256 and size report
- PyInstaller top-contributor report
- Smoke logs
- Installed-user screenshots or visible text evidence
- On-demand media-tools `manifest.json`
- Clear blocker report if any gate fails

Stop immediately and report if the installed runner cannot launch/connect, the installer hangs or has no visible wizard/log, pandas/numpy remain bundled, media tools are bundled by default, a paid API call would be required, or any secret/signed URL/customer credential could leak.
