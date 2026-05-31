# R3-M User-Flow Diagnostics Gate - 2026-05-27

## Status

- Mac: PASS, built/staged/installed locally as v1.0.17.
- Windows: PENDING, handoff sent for v1.0.27 verification.
- Live deployment: NOT DEPLOYED. Oracle version API was not changed.
- Paid actions: none. No paid AI, Apify, Naver publish/schedule/edit/save, or customer credentials were used.

## Purpose

R3-L showed the final no-paid gate was stable, but the real support/user flow still had one gap: web-side agent diagnostics did not expose compact `local_state` information. R3-M closes that gap and verifies the installed Mac app from the user's point of view.

## Changes

- Added compact `diagnostics.local_state` to agent readiness in:
  - `app.py`
  - `split_version/app.py`
- Extended Oracle report sanitizer to preserve only safe `local_state` fields in:
  - `oracle/aimax-reports-api/server.js`
- Added no-paid smoke coverage:
  - `scripts/smoke_agent_diagnostics_local_state.mjs`
  - updated `scripts/headless_agent_polling_smoke.py`
  - `scripts/r3m_user_flow_web_smoke.mjs`
- Bumped Mac app version:
  - `aimax_compliance.py` -> `v1.0.17`
  - `split_version/aimax_compliance.py` -> `v1.0.17`

## Mac Build And Install Evidence

- Built artifact: `dist/AIMAX.app`
- Built DMG: `dist/AIMAX-macos.dmg`
- Staged DMG: `dist/upload_installers/aimax-bundle-macos.dmg`
- Staged DMG SHA256: `b13a9eff47378af827fcb8c0d8207661d5ac06f4b75eebcefcab3eae2ae6db77`
- Previous staged Mac DMG archived to:
  - `dist/upload_installers/archive-macos-20260527-pre-v117-r3m-user-flow-diagnostics/aimax-bundle-macos.dmg`
- Installed app: `/Applications/AIMAX.app`
- Installed version: `1.0.17`

## No-Paid Verification

Passed:

- `python -m py_compile app.py split_version/app.py diagnostics/system_info.py local_agent/state_repair.py web_agent/client.py`
- `node --check oracle/aimax-reports-api/server.js`
- `python scripts/smoke_local_settings_preserve_secrets.py`
- `python scripts/smoke_legacy_appdata_self_heal.py`
- `python scripts/smoke_yeri_image_failure_diagnostics.py`
- `python scripts/preflight_split_drift.py`
- `python scripts/headless_agent_polling_smoke.py`
- `node scripts/smoke_agent_diagnostics_local_state.mjs`
- `node scripts/smoke_yeri_real_test_guard.mjs`
- PyInstaller Mac build
- `codesign --verify --deep --strict dist/AIMAX.app`
- `hdiutil verify dist/AIMAX-macos.dmg`
- Installed `/Applications/AIMAX.app` diagnostics probe
- Installed `/Applications/AIMAX.app` repair dry-run
- `codesign --verify --deep --strict /Applications/AIMAX.app`

Installed diagnostics summary:

- `version`: `v1.0.17`
- `frozen`: `true`
- `local_state.legacy_candidate_count`: `1`
- `local_state.stale_request_count`: `1`
- `local_state.repair_available`: `true`
- `local_state.repair_strategy`: `quarantine_only_no_delete`

Installed repair dry-run summary:

- `ok`: `true`
- `dry_run`: `true`
- `moved_count`: `2`
- `errors`: `[]`

## Actual User Flow Verification

Test account:

- `demo@aimax.ai.kr`

Mac flow tested with the installed app running in heartbeat-only mode:

1. Opened the real web app at `https://api.aimax.ai.kr/app`.
2. Reused the saved web session without printing tokens.
3. Confirmed the logged-in user was visible.
4. Confirmed the old report-attention prompt appeared and could be dismissed with "나중에 확인" without server mutation.
5. Confirmed dashboard showed:
   - agent status: `연결됨`
   - agent version: `v1.0.17`
   - platform: macOS
   - update notice: none
6. Confirmed settings tab showed:
   - overall guide progress: `6/7`
   - agent status: `연결됨`
   - agent version: `v1.0.17`
7. Confirmed update tab showed:
   - overall: `최신 상태`
   - current version: `v1.0.17`
   - latest/minimum server version currently shown by production: `v1.0.14`
8. Confirmed no job was claimed or executed during the check.

Screenshot:

- `/private/tmp/aimax_r3m_user_flow_connected.png`

Production note:

- Current production server still does not expose `environment.local_state` in web error-report payloads because the Oracle API sanitizer patch has not been deployed.
- Local patched sanitizer smoke passed, so this is ready for a later deploy gate after Windows v1.0.27 also passes.

## Windows Handoff

Windows target version:

- `v1.0.27`

Shared-Bridge folder:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-27-r3m-user-flow-diagnostics`

Returned files expected:

- `WINDOWS_RESULT_20260527_r3m_user_flow_diagnostics.md`
- `aimax_r3m_v127_user_flow_diagnostics_diag.json`
- `aimax-bundle-windows.exe`
- `NEXT_TRIGGER_20260527_r3m_user_flow_diagnostics.json`

Windows pass criteria:

- Windows v1.0.27 built and installed.
- Compact `diagnostics.local_state` is present in readiness/heartbeat.
- Oracle sanitizer preserves compact local-state fields and drops raw paths.
- Installed-user web flow passes with runner connected while the UI is open.
- R3-I/R3-J/R3-K regressions still pass: installer access denied fix, liveness/update recognition, protocol connect/open-settings, local settings save completion, legacy AppData self-heal.
- Installer SHA256 provided.
- No paid AI, Apify, Naver publish/schedule/edit/save, or customer credentials/secrets.

## Next Gate

Wait for Windows R3-M result. If Windows passes, stage Windows v1.0.27 locally and prepare a deploy-ready checklist for Mac v1.0.17 + Windows v1.0.27. Do not deploy live until the user explicitly approves the deployment gate.

## AI Council Residual Risk Check

AI Council was run with sanitized context only. Both reviewers agreed that the main remaining release risks are not the Mac user flow itself, but cross-platform rollout conditions:

- Verify the web app can tolerate Mac v1.0.17 and Windows v1.0.27 runner payloads at the same time.
- Verify older installed runners show a clear update/fallback path instead of breaking.
- Verify compact `local_state` diagnostics remain backward-compatible with pre-existing user state.
- Keep a rollback plan for the web API and staged installers.
- Watch Windows installer/update/remove and long-running runner resource behavior in the Windows gate.
