# Copy-Paste Prompt For Windows AI Developer

You are the Windows AI developer for AIMAX. Please read the latest handoff documents in the Syncthing folder first, then handle this task.

Task: Verify Songi cross-OS video-analysis readiness on Windows.

Use this Syncthing folder as read-only input/output exchange:

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-19-songi-cross-os-video-analysis/`

On Windows, copy the source ZIP out of Syncthing into a local Windows work folder. Do not build, run, or edit inside the shared folder. Do not put secrets, passphrases, `.env`, cookies, browser profiles, or raw API keys in Syncthing.

Source ZIP:

`aimax-songi-cross-os-video-analysis-source-20260519.zip`

Read:

`WINDOWS_AI_DEVELOPER_MESSAGE_20260519_SONGI_CROSS_OS_VIDEO_ANALYSIS.md`

Then:

1. Apply/replace the included files in a clean local AIMAX source tree:
   - `oracle/aimax-reports-api/server.js`
   - `oracle/aimax-reports-api/static/app.html`
2. Run:

```powershell
node --check oracle\aimax-reports-api\server.js
node -e "const fs=require('fs');const html=fs.readFileSync('oracle/aimax-reports-api/static/app.html','utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);for (const script of scripts) new Function(script); console.log('ok')"
```

3. Start local API:

```powershell
$env:AIMAX_REPORT_DATA_DIR = "$env:TEMP\aimax-songi-win-test-data"
$env:AIMAX_REPORT_PORT = "19088"
$env:AIMAX_REPORT_HOST = "127.0.0.1"
node oracle\aimax-reports-api\server.js
```

4. Verify `http://127.0.0.1:19088/app`:
   - `작업 > 송이` flow exists.
   - no HTML result button.
   - no storage-location UI.
   - results render as clean cards/lists, not raw Markdown/JSON.
   - completed result sections are readable.

5. Check whether Windows has:
   - `yt-dlp.exe`
   - `ffmpeg.exe`

6. If available, verify `/api/research/integrations` returns `media_tools` diagnostics. If authenticated API access is not available, report that as a blocker, not as a failure.

7. Do not run Gemini/Apify paid tests unless the user explicitly approves provider, model, action, and expected cost.

Return a Markdown report to the same Syncthing folder with:

- completion/blocker status
- Windows version/arch
- Node version
- media tool availability
- UI verification notes
- sanitized API diagnostics excerpt
- exact errors if any
- whether a Windows rebuild/release is required

