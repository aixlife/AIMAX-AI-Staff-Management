You are the Windows AIMAX developer. Build and verify the Songi YouTube discovery Windows release installer.

Read first:

1. `C:\Users\likim\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-05-28-songi-youtube-discovery-v131-release\WINDOWS_HANDOFF_20260528_songi_youtube_v131_release.md`
2. Latest R3-T v1.0.30 result docs in `C:\Users\likim\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-05-28-r3t-windows-installer-launch-visibility\`
3. Previous Songi source verification result in `C:\Users\likim\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-05-28-songi-youtube-discovery-local-runner\`

Task:

Copy `aimax_songi_youtube_v131_release_source_20260528.zip` out of Syncthing into a local Windows work folder. Do not build inside the shared folder. Merge the included Songi files onto the current Windows v1.0.30/R3-T-capable source without losing installer/launcher visibility fixes. Build target is Windows runner `v1.0.31`.

Required version updates:

- `aimax_compliance.py`: `APP_VERSION = "v1.0.31"`
- `split_version\aimax_compliance.py`: `APP_VERSION = "v1.0.31"`
- Inno `AppVersion`: `1.0.31`
- Go launcher diagnostics `launcherVersion`: `v1.0.31`

Required checks:

1. `python -m py_compile app.py split_version/app.py local_agent/runtime.py scripts/dev_songi_discovery_runner.py aimax_compliance.py split_version/aimax_compliance.py`
2. `node --check oracle/aimax-reports-api/server.js`
3. `node --check scripts/smoke_songi_discovery.mjs`
4. `gofmt -w packaging/windows/aimax_agent_launcher.go`, then build launcher through `python build.py`
5. `node scripts/smoke_songi_discovery.mjs` must print `SONGI_DISCOVERY_SMOKE_OK`
6. Confirm free/local `yt-dlp --skip-download --flat-playlist --no-warnings --dump-json --playlist-end 3 "ytsearch3:AI 직원"` works via local media-tools fallback if PATH lacks `yt-dlp`
7. Build `aimax-bundle-windows.exe`
8. Install normally with `/LOG`, verify visible wizard, uninstall entry `AIMAX 1.0.31`, protocol registration, visible launcher/connect guidance, and diagnostics `v1.0.31`
9. Verify Songi UI: separate `키워드로 찾기` and `링크로 분석` tabs, keyword tab has no profile/category/topic fields, multiple YouTube candidate cards render in a responsive grid with no overflow, link tab preserves the old workflow
10. Optional production UI check may confirm installed runner connects as `v1.0.31`, but do not submit a job.

Forbidden:

- No Apify.
- No Gemini/OpenAI/Claude paid generation.
- No YouTube Data API.
- No Naver publish/schedule/draft/edit/save/customer credentials.
- No live Oracle deploy.
- No Oracle version API change.
- Do not put secrets, browser cookies, signed URLs, or raw session data in Syncthing.

Return to the same Shared-Bridge folder:

- `WINDOWS_RESULT_20260528_songi_youtube_v131_release.md`
- `aimax_songi_youtube_v131_release_diag.json`
- `aimax-bundle-windows.exe`
- sanitized installer log
- UI screenshots if available
- installer SHA256

If blocked, write the exact blocker and whether the existing local build state can be resumed.
