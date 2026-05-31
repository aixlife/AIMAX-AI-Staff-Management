# Windows AI Developer Handoff - Songi Cross-OS Video Analysis

Date: 2026-05-19
Project: AIMAX AI Staff Management
Scope: Songi research worker, cross-OS runtime verification

## Context

Songi is now a worker inside the existing `작업` tab. The user-facing flow is:

1. `작업`
2. select `송이`
3. enter one or more benchmarking links
4. optionally enter Instagram profile or category/topic
5. confirm paid Gemini/Apify execution
6. view a structured card-style planning result in the web app
7. internally generate Markdown handoff files for the next employee

HTML result buttons and storage-location controls were removed from Songi's user-facing UI. The web app should show clear cards/lists only.

## Mac-Side Changes To Verify On Windows

Changed files are included in:

- `aimax-songi-cross-os-video-analysis-source-20260519.zip`

Changed source files:

- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`

Important changes:

- Windows default data directory now falls back to `%LOCALAPPDATA%\AIMAX\reports\data` when `AIMAX_REPORT_DATA_DIR` is not set.
- `yt-dlp` and `ffmpeg` command paths now strip accidental wrapping quotes.
- spawned media tools use `windowsHide: true` to avoid visible command windows.
- `/api/research/integrations` now returns `runtime` and `media_tools` diagnostics:
  - platform
  - data dir
  - `yt-dlp` availability/version
  - `ffmpeg` availability/version
  - video limits
- YouTube video analysis preflights media tools before download.
- frame extraction reports `research_frame_extractor_missing` if `ffmpeg` is not available.
- Songi paid confirmation warns when YouTube video file analysis tools are missing.

## Required Windows Validation

Do this in a local Windows work folder, not inside Syncthing.

1. Copy the source ZIP out of Syncthing into a clean local work folder.
2. Apply or replace the two included files in the AIMAX source tree.
3. Do not copy any `.env`, credentials, Keychain/DPAPI exports, cookies, or browser profiles into Syncthing.
4. Run syntax checks:

```powershell
node --check oracle\aimax-reports-api\server.js
node -e "const fs=require('fs');const html=fs.readFileSync('oracle/aimax-reports-api/static/app.html','utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);for (const script of scripts) new Function(script); console.log('ok')"
```

5. Start the local reports API on Windows:

```powershell
$env:AIMAX_REPORT_DATA_DIR = "$env:TEMP\aimax-songi-win-test-data"
$env:AIMAX_REPORT_PORT = "19088"
$env:AIMAX_REPORT_HOST = "127.0.0.1"
node oracle\aimax-reports-api\server.js
```

6. Verify the server starts without a visible media-tool console popup.
7. Open `http://127.0.0.1:19088/app`.
8. In `작업 > 송이`, verify:
   - Songi is inside the existing `작업` tab.
   - no `HTML 결과 보기` button is visible.
   - no storage-location/change UI is visible.
   - `송이에게 지시`, `브리프 복사`, and `프로젝트 삭제` are visible.
   - completed Songi results render as cards/lists, not raw Markdown/JSON.
   - `내 계정 적용 아이디어` splits numbered ideas into readable items.
   - `다음 직원 전달 브리프` shows topic/target/length and a video flow list.

9. Verify media tool diagnostics with an authenticated local session if available:
   - `/api/research/integrations` includes `media_tools.video_download` and `media_tools.frame_extract`.
   - With `yt-dlp.exe` and `ffmpeg.exe` on PATH, both should be `available: true`.
   - If either is missing, Songi should warn before paid YouTube analysis and should not crash.

10. If you run any Gemini/Apify test, follow paid API safety:
    - get explicit approval for provider, model, action, and expected cost
    - do not repeat a failed paid submit without checking whether a request/job already exists
    - do not place API keys or raw response secrets in reports

## Return Report Needed

Write a completion or blocker report back to the same Syncthing folder. Include:

- Windows version and CPU arch
- Node version
- whether `yt-dlp.exe` and `ffmpeg.exe` are installed/on PATH
- screenshots or text evidence for Songi UI checks
- `/api/research/integrations` sanitized JSON excerpt
- any failures with exact error text
- whether a Windows rebuild/release is required

