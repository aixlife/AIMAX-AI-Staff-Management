# AIMAX R3-I Actual-Test Checklist

Date: 2026-05-26 KST

## Status

R3-I Mac and Windows candidates are staged locally.

Live deployment is intentionally paused until actual user-flow tests pass.

Mac actual settings/open-settings test now passes on the staged `v1.0.15`
candidate. Windows `v1.0.24` evidence has already passed and is retained below.

## Versions

```text
macOS: v1.0.15
Windows: v1.0.24
```

## Fixes

### macOS v1.0.15

Targets latest Mac blocker:

```text
AIMAX-RPT-20260526043826-00f312ea
settings/password-save hang
```

Fix:

```text
Keychain write/delete timeout
local settings save moved off UI thread
fallback local secret storage still preserves values if Keychain stalls
Tkinter save completion now returns through a main-loop polling queue
Enter saves / Escape cancels in the local security settings dialog
```

### Windows v1.0.24

Targets latest Windows blocker:

```text
AIMAX-RPT-20260526065632-57438e24
installed latest but web still sees old v1.0.15
installer DeleteFile failed code 5 on aimax-agent-launcher.exe
```

Fix:

```text
native launcher exits after starting AIMAX.exe --agent
installer pre-closes AIMAX processes before replacing files
stale/dead single-instance lock recovery
stale request-file filtering
protocol connect/open-settings routes to v1.0.24 runtime
```

## Staged Local Installers

```text
dist/upload_installers/aimax-bundle-macos.dmg
sha256: 900af3671bdc322c29297fca3f1294806bf0ae0cefb156e54c7682dcf3415878

dist/upload_installers/aimax-bundle-windows.exe
sha256: 50a5012007318bcd5593df51b7529099db83921a3d5d1e3c0f998bcdfc9279d6
```

Previous staged installers archived:

```text
dist/upload_installers/archive-macos-20260526-pre-v115-r3i-keychain-hang-hotfix/aimax-bundle-macos.dmg
dist/upload_installers/archive-macos-20260526-pre-v115-r3i-enter-save-hotfix/aimax-bundle-macos.dmg
dist/upload_installers/archive-macos-20260526-pre-v115-r3i-final-tk-cleanup/aimax-bundle-macos.dmg
dist/upload_installers/archive-windows-20260526-pre-v124-r3i-runner-liveness-update-fix/aimax-bundle-windows.exe
```

## Mac Evidence So Far

```text
venv/bin/python -m py_compile app.py split_version/app.py local_agent/runtime.py: pass
codesign --verify --deep --strict dist/AIMAX.app: pass
hdiutil verify dist/AIMAX-macos.dmg: pass
frozen diagnostics version: v1.0.15
frozen runtime: true
ai_text_import_smoke.ok: true
diagnostics file: /private/tmp/aimax_r3i_v115_final_diag.json
Mac staged dmg sha256: 900af3671bdc322c29297fca3f1294806bf0ae0cefb156e54c7682dcf3415878
open_settings command id: b6fe8675-6271-49aa-a79a-58ead9bc3719
open_settings command status: done
open_settings command finished_at: 2026-05-26T11:45:13.513Z
runner status after save: connected
runner version after save: v1.0.15
current=v1.0.15 update_required: false
terminal-visible Tk variable cleanup warning after save: not reproduced in final candidate retest
```

## Windows Evidence So Far

Returned from:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3i-runner-liveness-update-fix
```

Key pass evidence:

```text
version: v1.0.24
installer DeleteFile code 5 seen: false
access denied seen: false
actual silent install with pre-running locked launcher: pass
protocol connect heartbeat version: v1.0.24
protocol open-settings heartbeat version: v1.0.24
current=v1.0.24 update_required: false
dead PID lock recovered: true
stale request ignored: true
frozen runtime: true
ai_text_import_smoke.ok: true
browser_version_detection.ok: true
installer sha256: 50A5012007318BCD5593DF51B7529099DB83921A3D5D1E3C0F998BCDFC9279D6
```

## Actual Tests Required Before Live Deployment

### Mac Actual Test

Passed against local/staged Mac `v1.0.15`:

```text
1. Install or run v1.0.15 candidate.
2. Connect web app with a safe/test account.
3. From web app, request local settings/open-settings.
4. Enter or preserve Naver ID/password using non-customer test data.
5. Save.
6. Confirm the app does not hang.
7. Confirm the settings command completes or reports a clear result.
8. Confirm web app sees connected runner v1.0.15.
9. Confirm current=v1.0.15 -> update_required=false in version check once test metadata points to v1.0.15, or use local stub metadata if live remains v1.0.14.
```

No Naver publish/schedule/edit/save is allowed in this actual test.

Actual Mac result:

```text
PASS
The web-issued open_settings command opened the local security settings dialog.
Pressing Enter saved the preserved local settings.
The dialog closed, the command reached done, and the runner stayed connected.
No paid AI, Apify, Naver publish/schedule/edit/save, or customer credentials were used.
```

### Windows Actual Test

Already reported by Windows Codex as passed, but Mac-side release gate should retain evidence:

```text
1. Install v1.0.24 over a state where old launcher is running.
2. Confirm no DeleteFile code 5/access denied.
3. Confirm web app/protocol reaches v1.0.24 runtime.
4. Confirm update_required=false for current=v1.0.24.
5. Confirm open-settings reaches current runtime.
```

## Safety

- No paid AI call.
- No Apify call.
- No Naver publish/schedule/edit/save mutation.
- No customer credentials.
- No live deployment until actual Mac test and Windows evidence review pass.

## Live Rollout Steps After Actual Tests Pass

Requires explicit user approval.

1. Back up current Oracle installer files and `.env`.
2. Upload staged Mac and Windows installers.
3. Update Oracle version API:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.15
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.15
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.24
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.24
```

4. Restart `systemctl --user restart aimax-reports-api.service`.
5. Verify public API and remote hashes.

## Next Gate

Run Mac actual settings-save/open-settings test before any live deployment.
