# AIMAX R3-J Actual-Test / Deploy-Ready Checklist

Date: 2026-05-27 KST

## Status

R3-J Mac/Windows candidates are staged locally.

Live deployment is intentionally paused until actual user-flow tests and the
newly discovered Legacy AppData conflict recovery gate are complete.

## Versions

```text
macOS: v1.0.15
Windows: v1.0.25
```

## Scope

R3-J fixes the local security settings save-completion parity issue.

Target behavior:

```text
open-settings dialog opens from web/protocol
save runs without worker-thread Tk calls
dialog closes after save
web command reaches done
runner stays connected
current installed version is reported to the web app
```

## Staged Local Installers

```text
dist/upload_installers/aimax-bundle-macos.dmg
sha256: 900af3671bdc322c29297fca3f1294806bf0ae0cefb156e54c7682dcf3415878

dist/upload_installers/aimax-bundle-windows.exe
sha256: 79204537e67b58088c50c609fa3652ada3ab019fe4fd1068908b19cccb1893b6
```

Previous Windows staged installer archived:

```text
dist/upload_installers/archive-windows-20260527-pre-v125-r3j-local-settings-save-completion-parity/aimax-bundle-windows.exe
sha256: 50a5012007318bcd5593df51b7529099db83921a3d5d1e3c0f998bcdfc9279d6
```

## Windows Evidence

Returned from:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3j-local-settings-save-completion-parity
```

Returned files:

```text
WINDOWS_RESULT_20260526_r3j_local_settings_save_completion_parity.md
aimax_r3j_v125_local_settings_save_completion_parity_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260526_r3j_local_settings_save_completion_parity.json
```

Key pass evidence:

```text
verdict: pass
version: v1.0.25
installer sha256: 79204537E67B58088C50C609FA3652ADA3AB019FE4FD1068908B19CCCB1893B6
frozen runtime: true
ai_text_import_smoke.ok: true
browser_version_detection.ok: true
DeleteFile code 5 / access denied during install: not seen
old launcher process closed by installer: pass
aimax://agent/connect uses v1.0.25 runtime: pass
aimax://agent/open-settings uses v1.0.25 runtime: pass
heartbeat/version payload reports v1.0.25: pass
current=v1.0.25 update_required=false: pass
dead PID lock / stale request recovery: pass
local settings save via web command reached status=done: pass
```

Safety evidence:

```text
No paid AI/OpenAI/Gemini/Claude/image calls.
No Apify calls.
No Naver publish/schedule/edit/save actions.
No customer account credentials.
No shared .env, cookies, browser profiles, secrets, or raw private logs.
```

## Mac Evidence

Mac evidence remains from R3-I v1.0.15:

```text
docs/deployments/r3i-actual-test-checklist-20260526-v115-v124.md
docs/deployments/macos-build-20260526-v115-r3i-keychain-hang-hotfix.md
```

Key pass evidence:

```text
version: v1.0.15
frozen runtime: true
open_settings command status: done
runner status after save: connected
runner version after save: v1.0.15
current=v1.0.15 update_required: false
```

## Actual Tests Still Required Before Live Deployment

### Mac

Retain the existing v1.0.15 actual-test result unless Mac source changes again.

Required before live deployment:

```text
confirm installed Mac candidate still reports v1.0.15
confirm web open-settings save remains done
confirm no paid AI, Apify, Naver publish/schedule/edit/save, or customer credentials
```

### Windows

Windows R3-J actual install and web-recognition evidence passed.

Before live deployment, retain the returned evidence and confirm staged local
installer hash matches:

```text
79204537e67b58088c50c609fa3652ada3ab019fe4fd1068908b19cccb1893b6
```

## New Blocker / Next Gate

A Windows user reported that deleting old AppData folders beginning with
`naverblog` made the runner work again. This indicates a separate class of
failure:

```text
Legacy AppData state contamination / local runner data conflict
```

Do not treat R3-J as final live-deploy-ready until a repair path is defined and
tested for this class.

Recommended next phase:

```text
R3-K: Legacy AppData Self-Heal
```

R3-K should add:

```text
legacy NaverBlog*/naverblog* AppData detection
safe quarantine/rename instead of hard delete
stale lock/request/error/cache cleanup
sanitized diagnostics in error reports
Windows reproduction smoke with synthetic legacy AppData
one-click local runner repair UX or web-triggered repair command
```

## Live Rollout Steps After Gates Pass

Requires explicit user approval.

1. Back up current Oracle installer files and `.env`.
2. Upload staged Mac and Windows installers.
3. Update Oracle version API:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.15
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.15
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.25
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.25
```

4. Restart `systemctl --user restart aimax-reports-api.service`.
5. Verify public version API and remote hashes.

## Decision

R3-J Windows result is pass and the Windows v1.0.25 installer is staged locally.

Live deployment remains paused. Proceed to R3-K before live rollout.
