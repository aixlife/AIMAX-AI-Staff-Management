# Windows Handoff - 2026-05-29 - v1.0.33 Songi server fallback + popup/claim final gate

## Context

The earlier Windows v1.0.32 candidate fixed repeated visible console popups and runner claim polling, but it was marked candidate-not-final. After reviewing session `019e6c4e-81ea-72b3-95c6-8554917bd055` and the latest macOS error report, Mac-side source now includes an additional fix: Songi YouTube keyword discovery must be web/server-first, with the local runner only as a fallback. This prevents macOS v1.0.17 or other old runners from failing with `지원하지 않는 웹앱 명령입니다: songi_youtube_discovery`.

Because the source changed after the v1.0.32 candidate artifact, the final Windows target is bumped to `v1.0.33` to avoid SHA/version ambiguity.

## Source Files

Use the `source-files/` folder in this Syncthing handoff as the canonical patch source. Copy these files into a local Windows work folder before building. Do not build inside the shared folder.

- `app.py`
- `split_version/app.py`
- `web_agent/client.py`
- `aimax_compliance.py`
- `split_version/aimax_compliance.py`
- `build.py`
- `AIMAX.spec`
- `packaging/windows/aimax_agent_launcher.go`
- `packaging/windows/aimax_installer.iss`
- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `scripts/smoke_songi_discovery.mjs`
- `scripts/smoke_songi_discovery_server_fallback.mjs`

## Required Fixes To Preserve

- `v1.0.33` version in app compliance files, Windows Inno installer, and launcher.
- Windows launcher detects `%APPDATA%\NaverBlogAuto\aimax-local-agent.lock`, identifies a live core PID, logs `core_already_running_lock`, and shows visible already-running guidance instead of starting/quick-exiting another core.
- Windows subprocess probes for media tools use hidden-window kwargs, and readiness probe results are cached to prevent repeated terminal popups from heartbeat/status polling.
- `web_agent.client.next_job(platform_label, device_label)` accepts optional platform/device query params.
- Runner diagnostics include polling fields and server claim diagnostics.
- Songi YouTube discovery:
  - Oracle server can perform `server_ytdlp` public metadata discovery when server yt-dlp is available.
  - Web UI treats `pending_runner=false` server results as complete and does not wait for a local command.
  - Local runner command path still works when server fallback is disabled.
  - Bundled/frozen local runtime includes `yt_dlp` Python module support.
- No paid AI, Apify, YouTube Data API, Naver publish/schedule/edit/save, customer credential use, live deploy, Oracle version API change, or duplicate paid retry.

## Verification

Run these no-paid checks on Windows after applying the source:

1. `python -m py_compile app.py split_version\app.py web_agent\client.py aimax_compliance.py split_version\aimax_compliance.py`
2. `node --check oracle\aimax-reports-api\server.js`
3. `node scripts\smoke_songi_discovery.mjs`
4. `node scripts\smoke_songi_discovery_server_fallback.mjs`
5. Go launcher compile check.
6. PyInstaller build via `python build.py`.
7. Inno installer build.
8. Confirm final installer is `AIMAX 1.0.33`; provide final SHA256 and size.
9. Run the normal non-silent installer with explicit `/LOG`; verify window appears within 30 seconds, progress/completion is visible, log file is created, and no hidden/titleless setup process remains.
10. Verify `aimax://` protocol registration and uninstall entry or per-user LocalAppData representation.
11. With an installed runner already running, run `aimax-agent-launcher.exe aimax://agent/connect`; verify visible Korean guidance/dialog, no second core, no `core_exited_quickly`, and diagnostics include `core_already_running_lock`.
12. Confirm heartbeat diagnostics include polling fields and server claim diagnostics, including `ready_for_publish_claim_enabled` and claimable statuses.
13. Confirm repeated heartbeat/status does not spawn visible `yt-dlp.exe --version` or other terminal windows.
14. Existing job `1131624c-db33-4fab-9366-43c997a9b430` may only be checked in claim-only/stop-before-Naver mode. If that mode is unavailable, do not test the job and report the blocker. No Naver mutation is approved.

## Return Files

Return these to the same shared folder:

- `WINDOWS_RESULT_20260529_v133_songi_server_fallback_final.md`
- `aimax_v133_songi_server_fallback_final_diag.json`
- final `aimax-bundle-windows.exe` only if all no-paid final gates pass
- `NEXT_TRIGGER_20260529_v133_songi_server_fallback_final.json`
- sanitized logs/evidence, including installer `/LOG` summary and launcher diagnostics

## Pass/Block Rule

If all gates pass, stage the installer and prepare a no-paid deploy-ready checklist plus a separate live deploy/version API approval request only. Do not deploy live or change Oracle version API.

If blocked, report the narrow blocker, whether the current v1.0.33 source/artifact can be reused, and whether a rebuild is required.
