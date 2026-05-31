# AIMAX Installer Size Optimization Progress - 2026-05-28

## Sequence

1. Archive cleanup - done
2. Size report automation - done
3. PyInstaller `collect-all` reduction experiment - done
4. pandas removal experiment - done
5. Windows media-tools on-demand - source/handoff prepared, Windows verification pending

## Results

- `dist/upload_installers` archives: 32 -> 10
- Disk reclaimed from old installer archives: about 2.3GB
- Current size report:
  - `dist/upload_installers`: 1.3GB
  - `aimax-bundle-macos.dmg`: 62.5MB
  - `aimax-bundle-windows.exe`: 130.3MB
  - `dist/AIMAX`: 118.3MB
- PyInstaller collect-reduced temp build: 108.9MB
- pandas-free temp build: 78.6MB
- Frozen diagnostics passed for the optimized temp build.

## Source Changes

- Added safe archive cleanup automation: `scripts/cleanup_installer_archives.py`
- Added read-only size reporting: `scripts/installer_size_report.py`
- Added isolated PyInstaller experiment runner: `scripts/pyinstaller_collect_experiment.py`
- Replaced pandas Excel loading with `openpyxl`: `bulk/excel_loader.py`
- Updated production build configs to use the proven collect-reduced/pandas-free options.
- Added dynamic media-tools lookup and missing-tool diagnostics to reports API and admin copies.
- Changed Windows media-tools helper to default to user on-demand cache:
  `%LOCALAPPDATA%\AIMAX\media-tools\win32\x64`

## Verified

- `node --check oracle/aimax-reports-api/server.js`
- HTML script syntax check for web app and admin
- `python -m py_compile` for changed Python build/smoke scripts
- `python scripts/smoke_excel_loader_no_pandas.py`
- `node scripts/smoke_json_storage_safety.mjs`
- `node scripts/smoke_error_report_context.mjs`

## Release Gate

Not deploy-ready yet. Before any installer rollout or version API change:

- macOS installed-runner real web UI path must pass
- Windows installed-runner real web UI path must pass
- Windows must verify optimized build, no pandas/numpy bundle, and media-tools on-demand behavior
- no paid Gemini/Apify/OpenAI flow may run without explicit paid-scope approval
