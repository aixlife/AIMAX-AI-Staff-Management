Read first:
`WINDOWS_HANDOFF_20260523_cross_platform_local_settings.md`

Goal:
Check and, if needed, patch the Windows runner so the Mac fix is not Mac-only. We need cross-platform behavior to be stable for users who use the same AIMAX account on both Windows and Mac.

Rules:
- Work outside the Syncthing/shared-bridge folder. Copy files into a local Windows work folder first.
- Do not expose or copy secrets, API keys, cookies, browser profiles, `.env`, signed URLs, or raw private logs.
- Do not run paid AI calls.
- Do not run Apify Actors.
- Do not run real Naver publish/save/draft tests.
- Do not downgrade Windows version metadata using Mac `v1.0.10` values.

Context:
- Oracle web/server fix is already deployed.
- Mac bundle is now `v1.0.10`.
- Windows public latest/min remains `v1.0.16`.
- The server bug was user-only agent state. Status/commands are now platform-targeted.
- Remaining Windows question: does the Windows runner UI/packaged source still open a confusing local settings window with Gemini/Claude/OpenAI/Apify fields when the web dashboard asks for local settings?

Use source only if needed:
`source-tree-cross-platform-local-settings-20260523.zip`

Important:
The zip intentionally excludes `aimax_compliance.py` version files. If you apply these source changes to Windows and rebuild, keep Windows metadata on the Windows line. If a new rebuild is needed, use the next Windows version, likely `v1.0.17`.

Check:
1. Windows update page must remain Windows-specific:
   - current `v1.0.15` should require `v1.0.16`
   - no macOS `v1.0.10` text should appear on Windows
2. Web `로컬 설정 열기` command:
   - Windows target command should be received by Windows runner
   - Mac target command should not be consumed by Windows runner
   - the opened local settings UX should be Naver ID/password centered
   - existing local AI/API keys must not be deleted
3. Download/install:
   - Windows installer file must remain the Windows artifact
   - Mac DMG deployment must not affect Windows download

Run no-paid checks:
- `python -m py_compile .\app.py .\split_version\app.py .\local_agent\runtime.py .\web_agent\client.py`
- `node --check .\oracle\aimax-reports-api\server.js`
- app.html embedded script parse
- `python verify_v113_login_ime_guard.py`
- `python verify_v114_local_settings_ux.py`
- `python verify_v110_no_paid_editor_smoke.py`
- If available, run or adapt `scripts\smoke_local_secret_import.mjs` to verify platform-specific agent status and command routing.

Return:
Create `WINDOWS_COMPLETION_20260523_cross_platform_local_settings.md` in the shared folder with:
- decision: no rebuild needed / rebuild needed / rebuilt
- exact Windows version tested or built
- artifact path and SHA256 if rebuilt
- verification commands and outputs
- whether web-opened local settings still shows AI/API fields
- whether platform-specific command routing passed
- blockers and risks
