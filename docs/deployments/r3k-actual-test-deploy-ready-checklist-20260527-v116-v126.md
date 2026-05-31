# AIMAX R3-K Actual-Test / Deploy-Ready Checklist

Date: 2026-05-27 KST

## Status

R3-K Mac and Windows candidates are staged locally.

Live deployment is intentionally paused. No Oracle version API or live installer
files were changed.

## Versions

```text
macOS: v1.0.16
Windows: v1.0.26
```

## Scope

R3-K addresses a real Windows recovery case where deleting old AppData folders
beginning with `naverblog` made the AIMAX runner work again.

The product fix is conservative:

```text
detect legacy NaverBlog*/naverblog* local-state folders
detect stale AIMAX local-agent request files
include system.local_state in diagnostics/error reports
provide hidden --repair-local-state CLI
quarantine by move/rename only
never hard-delete user data
preserve fresh request files and lock files
```

## Staged Local Installers

```text
dist/upload_installers/aimax-bundle-macos.dmg
sha256: d44263e506baa50cd02df3aa53c67cccfd7d39438358724161f01c408802f1ba

dist/upload_installers/aimax-bundle-windows.exe
sha256: c9488bcb7905b0199cfa518df9e6c487205cc89c54e21cd2d35d7f8a26d7a938
```

Previous staged installers archived:

```text
dist/upload_installers/archive-macos-20260527-pre-v116-r3k-legacy-appdata-self-heal/aimax-bundle-macos.dmg
sha256: 900af3671bdc322c29297fca3f1294806bf0ae0cefb156e54c7682dcf3415878

dist/upload_installers/archive-windows-20260527-pre-v126-r3k-legacy-appdata-self-heal/aimax-bundle-windows.exe
sha256: 79204537e67b58088c50c609fa3652ada3ab019fe4fd1068908b19cccb1893b6
```

## Mac Evidence

Detailed build record:

```text
docs/deployments/macos-build-20260527-v116-r3k-legacy-appdata-self-heal.md
```

Key evidence:

```text
version: v1.0.16
frozen runtime: true
ai_text_import_smoke.ok: true
system.local_state present: true
repair_strategy: quarantine_only_no_delete
codesign --verify --deep --strict: pass
hdiutil verify: checksum valid
repair dry-run: ok=true, dry_run=true
```

Installed-app actual test on this Mac:

```text
/Applications/AIMAX.app installed version: v1.0.16
CFBundleShortVersionString: 1.0.16
CFBundleVersion: 1.0.16
installed diagnostics: frozen=true, ai_text_import_smoke.ok=true
installed diagnostics includes system.local_state: true
installed repair dry-run: ok=true, dry_run=true, planned moves=2, errors=[]
installed web heartbeat-only status: connected=true, status=connected
web-reported runner version: v1.0.16
web update_required: false
web current_version: v1.0.16
web latest_version: v1.0.14
```

Installed-app actual test artifacts:

```text
/private/tmp/aimax_installed_r3k_v116_diag.json
/private/tmp/aimax_installed_r3k_v116_repair_dry_run.json
/private/tmp/aimax_r3k_installed_agent.log
```

No-paid source smokes:

```text
R3K_LEGACY_APPDATA_SELF_HEAL_OK
LOCAL_SETTINGS_PRESERVE_SECRETS_OK
split drift preflight passed
```

## Windows Evidence

Returned from:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-27-r3k-legacy-appdata-self-heal
```

Returned files:

```text
WINDOWS_RESULT_20260527_r3k_legacy_appdata_self_heal.md
aimax_r3k_v126_legacy_appdata_self_heal_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260527_r3k_legacy_appdata_self_heal.json
```

Key pass evidence:

```text
verdict: pass
version: v1.0.26
installer sha256: C9488BCB7905B0199CFA518DF9E6C487205CC89C54E21CD2D35D7F8A26D7A938
legacy AppData self-heal smoke: ok
local settings sensitive value preservation: ok
R3-J local settings save completion parity: ok
R3-I runner liveness/update fix: ok
frozen diagnostics: version v1.0.26, frozen true
installed diagnostics: version v1.0.26, frozen true
ai_text_import_smoke.ok: true
browser_version_detection.ok: true
system.local_state present: true
DeleteFile code 5/access denied: not seen
aimax://agent/connect reaches v1.0.26 runtime
aimax://agent/open-settings reaches v1.0.26 runtime
web open-settings command done: true
current=v1.0.26 update_required=false
```

Self-heal verification from Windows diagnostics:

```text
dry_run_ok: true
dry_run_planned_move_count: 3
repair_ok: true
repair_moved_count: 3
legacy_candidate_count_after: 0
stale_request_count_after: 0
fresh_request_preserved: true
lock_file_preserved: true
repair_strategy: quarantine_only_no_delete
```

## Residual Observation

Windows diagnostics also reported:

```text
active_runtime_app_data_dir_name: NaverBlogAuto
installed_diag_legacy_candidate_count: 1
```

This did not block the returned R3-K pass because the frozen CLI repair test
quarantined the synthetic conflicts correctly and the installed runner still
reported `v1.0.26` with `update_required=false`.

Before live deployment, keep this as a support observation: if any installed
environment is still actively using a legacy-named data directory, the repair UI
must avoid blind cleanup and keep quarantine-only behavior.

## Safety

```text
No paid AI/OpenAI/Gemini/Claude/image calls.
No Apify calls.
No Naver publish/schedule/edit/save actions.
No customer credentials.
No live deployment.
No Oracle version API changes.
No shared secrets, .env, cookies, browser profiles, DPAPI material, or raw private logs.
```

## Actual Tests Before Live Deployment

### Mac

Completed on this Mac:

```text
install/run v1.0.16 candidate on this Mac: pass
confirm web runner reports v1.0.16: pass
confirm diagnostics includes system.local_state: pass
confirm repair dry-run reports ok=true: pass
do not run real repair unless explicitly approved
do not run paid AI/Apify/Naver mutation/customer credentials
```

### Windows

Windows Codex already returned actual installer/webapp/runner evidence as pass.
Before live deployment, retain returned evidence and confirm the staged installer
hash remains:

```text
c9488bcb7905b0199cfa518df9e6c487205cc89c54e21cd2d35d7f8a26d7a938
```

## Live Rollout Steps After Approval

Requires explicit user approval.

1. Back up current Oracle installer files and `.env`.
2. Upload staged Mac and Windows installers.
3. Update Oracle version API:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.16
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.16
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.26
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.26
```

4. Restart `systemctl --user restart aimax-reports-api.service`.
5. Verify public API and remote installer hashes.

## Decision

R3-K is staged locally on Mac and Windows, and the no-paid direct actual tests
for the installed Mac app and Windows installer/web/runner evidence are retained.

Live deployment remains paused until the user approves deployment.
