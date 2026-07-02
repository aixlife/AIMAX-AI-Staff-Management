# Windows Handoff - Songi YouTube Discovery v1.0.31 Release Build

Date: 2026-05-28 KST

## Objective

Build and verify a deploy-ready Windows AIMAX installer that includes Songi keyword-based YouTube benchmarking research.

Target Windows runner version: `v1.0.31`

This is a release gate, not only a source-mode check. The returned installer may be deployed to Oracle only after the checks below pass.

## Source Package

Use the source bundle in this folder:

- `aimax_songi_youtube_v131_release_source_20260528.zip`
- SHA256: `2d8bdfc3294154b92612c78173cae7d40d35984f405022231d106cfd0662b1d4`

Included files:

- `source-files/app.py`
- `source-files/split_version/app.py`
- `source-files/local_agent/runtime.py`
- `source-files/oracle/aimax-reports-api/server.js`
- `source-files/oracle/aimax-reports-api/static/app.html`
- `source-files/packaging/windows/aimax_agent_launcher.go`
- `source-files/packaging/windows/aimax_installer.iss`
- `source-files/scripts/smoke_songi_discovery.mjs`
- `source-files/scripts/dev_songi_discovery_runner.py`
- `source-files/docs/songi_free_keyword_discovery_plan_20260528.md`

Do not build inside the Syncthing shared folder. Copy the source bundle or files into a local Windows work folder first.

## Important Merge Note

The release must preserve the R3-T `v1.0.30` installer/launcher visibility fixes:

- visible normal installer wizard
- post-install `aimax://agent/connect`
- visible `AIMAX 실행기 연결됨` / already-running guidance
- launcher diagnostics under `%APPDATA%\AIMAX\launcher_diagnostics`
- no silent launcher failures

The included `packaging/windows` files are already updated toward `v1.0.31`, but if your local Windows workspace has newer R3-T launcher changes, merge rather than blindly reverting them.

## Required Version Changes

Before building, set Windows package version to `v1.0.31`:

- `aimax_compliance.py`: `APP_VERSION = "v1.0.31"`
- `split_version/aimax_compliance.py`: `APP_VERSION = "v1.0.31"`
- `packaging/windows/aimax_installer.iss`: `AppVersion` must be `1.0.31`
- `packaging/windows/aimax_agent_launcher.go`: `launcherVersion` must be `v1.0.31`

Do not change macOS release state or macOS installer files in this handoff.

## Required No-Paid Checks

Run all checks without paid AI/API calls:

1. Static checks
   - `python -m py_compile app.py split_version/app.py local_agent/runtime.py scripts/dev_songi_discovery_runner.py aimax_compliance.py split_version/aimax_compliance.py`
   - `node --check oracle/aimax-reports-api/server.js`
   - `node --check scripts/smoke_songi_discovery.mjs`
   - `gofmt -w packaging/windows/aimax_agent_launcher.go`
   - Go launcher build must pass through the normal `python build.py` path.

2. Songi server/command smoke
   - `node scripts/smoke_songi_discovery.mjs`
   - Expected: `SONGI_DISCOVERY_SMOKE_OK`
   - Confirm no YouTube Data API key, Apify token, Gemini key, or paid provider key is used.

3. Free/local YouTube metadata check
   - Confirm `yt-dlp` can be resolved from one of:
     - `AIMAX_SONGI_YTDLP_PATH`
     - PATH
     - `%LOCALAPPDATA%\AIMAX\media-tools\win32\x64\yt-dlp.exe`
     - bundled `oracle\aimax-reports-api\vendor\media-tools\win32\x64\yt-dlp.exe`
   - Run a no-download check such as:
     - `yt-dlp --skip-download --flat-playlist --no-warnings --dump-json --playlist-end 3 "ytsearch3:AI 직원"`
   - Do not download video files.

4. Build
   - Run `python build.py`.
   - Compile Inno installer to produce `aimax-bundle-windows.exe`.
   - Installer must report version `1.0.31`.

5. Installed runner gate
   - Install the produced `aimax-bundle-windows.exe` normally, non-silent, with explicit `/LOG`.
   - Verify visible wizard progress/completion.
   - Verify uninstall entry `AIMAX 1.0.31`.
   - Verify `aimax://` protocol command points to installed `aimax-agent-launcher.exe`.
   - Verify post-install/shortcut/protocol launch shows visible connection guidance and does not silently disappear.
   - Verify launcher diagnostics show `launcher_version: v1.0.31` and do not contain raw secrets or full signed URLs.

6. UI and Songi keyword board
   - Use a local test server or production-like local server with the included `app.html`.
   - Confirm `송이 자료조사` shows `키워드로 찾기` and `링크로 분석` as separate top-level task tabs.
   - Confirm `키워드로 찾기` does not expose profile/category/topic fields.
   - Enter a keyword and confirm multiple benchmarking cards render in a responsive grid.
   - Confirm no text overflow, no broken card layout, and no single oversized card layout.
   - Confirm `링크로 분석` still shows the existing project/profile/category/topic/link workflow.

7. Production readiness check
   - You may open production UI with the approved demo/test session to confirm the installed runner connects as `v1.0.31`.
   - Do not submit a job, do not run paid generation, and do not mutate Naver content.
   - Do not deploy live and do not change Oracle version API from Windows.

## Forbidden In This Handoff

- No Apify calls.
- No Gemini/OpenAI/Claude paid generation.
- No YouTube Data API usage.
- No Naver publish, schedule, draft save, edit, or customer credential use.
- No Oracle live deploy.
- No Oracle version API change.
- Do not store secrets, browser cookies, signed URLs, or raw session data in Syncthing.

## Return Files

Return these to this same Shared-Bridge folder:

- `WINDOWS_RESULT_20260528_songi_youtube_v131_release.md`
- `aimax_songi_youtube_v131_release_diag.json`
- `aimax-bundle-windows.exe`
- installer `/LOG` output, sanitized
- UI screenshots for keyword board and link workflow if available
- SHA256 for the installer

If blocked, return a narrow blocker report with exact command, error, and whether the build can resume without rebuilding from scratch.

## Mac Deploy After Pass

After Windows returns PASS, Mac side will:

1. Stage the returned Windows installer into `dist/upload_installers/aimax-bundle-windows.exe`.
2. Deploy `oracle/aimax-reports-api/server.js` and `static/app.html`.
3. Upload the Windows installer to Oracle downloads.
4. Update Windows latest/min version API to `v1.0.31`.
5. Verify health, `/api/version`, authenticated download options, production UI, and post-deploy no-paid status.
