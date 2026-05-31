You are the Windows AI developer for AIMAX. Read the latest handoff docs in:

`C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-29-v133-songi-server-fallback-final`

First copy the source files out of Syncthing into a local Windows work folder. Do not build inside the shared folder. Keep secrets, passphrases, browser profiles, cookies, raw tokens, signed URLs, and customer credentials out of Syncthing.

Task: apply and verify the merged `v1.0.33` source. This combines the Windows v1.0.32 popup/claim fixes with the new Mac/server-side Songi YouTube server fallback fix. The intended behavior is web/server-first Songi YouTube discovery, with local runner only as fallback. Old Mac runners must not fail the web flow with `지원하지 않는 웹앱 명령입니다: songi_youtube_discovery`.

Preserve these fixes:
- `v1.0.33` in app compliance files, Inno installer, and launcher.
- Launcher detects the live core from `%APPDATA%\NaverBlogAuto\aimax-local-agent.lock`, logs `core_already_running_lock`, and shows visible Korean already-running guidance without starting a second core.
- Windows subprocess checks for media tools are hidden and cached so heartbeat/status cannot keep popping terminal windows.
- `web_agent.client.next_job(platform_label, device_label)` accepts optional platform/device args.
- Runner diagnostics include polling fields; server diagnostics expose `ready_for_publish_claim_enabled` and claimable statuses.
- Server `server_ytdlp` Songi YouTube discovery completes with `pending_runner=false`; local runner command path still works when server fallback is disabled.
- Bundled/frozen local runtime includes `yt_dlp`.

Run these no-paid checks:
1. `python -m py_compile app.py split_version\app.py web_agent\client.py aimax_compliance.py split_version\aimax_compliance.py`
2. `node --check oracle\aimax-reports-api\server.js`
3. `node scripts\smoke_songi_discovery.mjs`
4. `node scripts\smoke_songi_discovery_server_fallback.mjs`
5. Go launcher compile check.
6. PyInstaller build with `python build.py`.
7. Inno installer build.
8. Normal non-silent installer run with explicit `/LOG`; verify visible setup window within 30 seconds, visible progress/completion, log created, and no hidden/titleless setup remains.
9. Verify `aimax://` protocol and uninstall entry/per-user LocalAppData representation.
10. With an installed runner already running, run `aimax-agent-launcher.exe aimax://agent/connect`; verify visible Korean guidance/dialog, no second core, no `core_exited_quickly`, and diagnostic event `core_already_running_lock`.
11. Confirm repeated heartbeat/status does not spawn visible `yt-dlp.exe --version` or other terminal windows.
12. Existing job `1131624c-db33-4fab-9366-43c997a9b430` may only be checked in claim-only/stop-before-Naver mode. If unavailable, do not test it and report that blocker. No Naver mutation is approved.

Do not run paid AI, Apify, YouTube Data API, Naver publish/schedule/edit/save, customer credential tests, live deploy, Oracle version API changes, or duplicate paid retries.

Return:
- `WINDOWS_RESULT_20260529_v133_songi_server_fallback_final.md`
- `aimax_v133_songi_server_fallback_final_diag.json`
- final `aimax-bundle-windows.exe` only if all no-paid final gates pass
- `NEXT_TRIGGER_20260529_v133_songi_server_fallback_final.json`
- sanitized installer `/LOG` summary and launcher diagnostics

If pass, stage the installer and prepare a no-paid deploy-ready checklist plus a separate live deploy/version API approval request only. If blocked, report the narrow blocker and whether the current v1.0.33 source/artifact can be reused or must be rebuilt.
