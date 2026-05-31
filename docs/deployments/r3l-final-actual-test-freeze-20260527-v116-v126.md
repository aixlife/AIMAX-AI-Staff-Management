# AIMAX R3-L Final Actual-Test Freeze

Date: 2026-05-27 KST

## Status

R3-L no-paid final actual-test gate passed for the current staged candidates:

```text
macOS candidate: v1.0.16
Windows candidate: v1.0.26
```

Live deployment remains paused. No Oracle version API, live installer files,
paid AI, Apify, Naver mutation, or customer credentials were used.

## Phase Purpose

R3-L verifies that the post-R3-K candidates can be treated as deploy-ready from
the local-runner stability perspective:

```text
runner web recognition
update-required behavior
settings-save regression safety
image failure diagnostics
empty/failed image handling
legacy local-state self-heal by quarantine only
Windows installer replacement/liveness evidence retention
```

## AI Council Input

AI Council was run with sanitized context only:

```text
council-runs/20260527-014618-aimax-local-desktop-runner-release-candidate-is-
participants: Claude, Gemini
```

Council risk themes:

```text
quarantine path must not silently fail
settings save should survive restart/regression paths
Mac/Windows version API must branch correctly
old versions must become update_required after rollout metadata changes
network/update instability should be visible rather than destructive
```

R3-L mapped those risks to no-paid tests below.

## Mac Installed Candidate Evidence

Installed app:

```text
/Applications/AIMAX.app
CFBundleShortVersionString: 1.0.16
CFBundleVersion: 1.0.16
codesign --verify --deep --strict: pass
```

Diagnostics:

```text
artifact: /private/tmp/aimax_r3l_macos_installed_diag.json
app.version: v1.0.16
runtime.frozen: true
ai_text_import_smoke.ok: true
system.local_state present: true
legacy_candidate_count: 1
stale_request_count: 1
repair_available: true
repair_strategy: quarantine_only_no_delete
```

Repair dry-run:

```text
artifact: /private/tmp/aimax_r3l_macos_installed_repair_dry_run.json
ok: true
dry_run: true
planned move count: 2
errors: []
```

Web heartbeat-only actual check:

```text
account: demo@aimax.ai.kr
base_url: https://api.aimax.ai.kr
connected: true
status: connected
version: v1.0.16
can_execute: true
job/command fetch: disabled by AIMAX_AGENT_HEARTBEAT_ONLY=1
```

## Windows Candidate Evidence

Retained from Windows result folder:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-27-r3k-legacy-appdata-self-heal
```

Windows result summary:

```text
verdict: pass
version: v1.0.26
installed diagnostics: frozen true
ai_text_import_smoke.ok: true
browser_version_detection.ok: true
system.local_state present: true
DeleteFile code 5/access denied: not seen
safe test login: ok
aimax://agent/connect: v1.0.26 runtime verified
aimax://agent/open-settings: v1.0.26 runtime verified
local settings save/open-settings command: done
current=v1.0.26 update_required=false
paid AI/Apify/Naver/customer/live deploy: not used
```

Windows self-heal:

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

## No-Paid Regression Tests

Passed:

```text
venv/bin/python -m py_compile app.py split_version/app.py diagnostics/system_info.py local_agent/state_repair.py web_agent/client.py
venv/bin/python scripts/smoke_legacy_appdata_self_heal.py
venv/bin/python scripts/smoke_local_settings_preserve_secrets.py
venv/bin/python scripts/smoke_yeri_image_failure_diagnostics.py
venv/bin/python scripts/headless_agent_polling_smoke.py
node scripts/smoke_yeri_real_test_guard.mjs
venv/bin/python scripts/preflight_split_drift.py
venv/bin/python scripts/agent_heartbeat_only_smoke.py --timeout 20
```

Notes:

```text
headless_agent_polling_smoke and smoke_yeri_real_test_guard needed unsandboxed
local 127.0.0.1 server binding, then passed.
```

Key no-paid coverage:

```text
open_settings command reaches done in headless smoke
yeri_write and hyunju_find dispatch paths reach done with test doubles
forced Yeri failure reports structured failed_posts/cost/images data
heartbeat-only mode does not consume queued commands/jobs
paid real-test guard blocks unapproved/oversized tests
empty/failed image diagnostics are structured
settings preserve provider secrets across local security settings save
legacy local-state repair quarantines by move/rename, not delete
```

## Version API Gate

Current live API is intentionally still old because R3-L did not deploy:

```text
live macos latest/min: v1.0.14/v1.0.14
live windows latest/min: v1.0.23/v1.0.23
candidate current values report update_required=false
```

Future rollout metadata was checked against a local server without touching live:

```text
macos current v1.0.16 -> update_required=false
macos old v1.0.14 -> update_required=true
windows current v1.0.26 -> update_required=false
windows old v1.0.23 -> update_required=true
```

## Installer Hashes

```text
d44263e506baa50cd02df3aa53c67cccfd7d39438358724161f01c408802f1ba  dist/upload_installers/aimax-bundle-macos.dmg
c9488bcb7905b0199cfa518df9e6c487205cc89c54e21cd2d35d7f8a26d7a938  dist/upload_installers/aimax-bundle-windows.exe
```

## Residual Findings

Not blockers for the no-paid R3-L gate:

```text
1. The installed Mac machine still has a legacy NaverBlogAuto data folder and a stale AIMAX request file.
   R3-L only ran dry-run on the user's Mac, so no user data was moved.

2. Web agent status diagnostics currently expose limited agent diagnostics.
   Full system.local_state is present in local diagnostics/error reports, but web reportEnvironmentPayload()
   does not yet automatically include the compact local_state summary from heartbeat diagnostics.

3. R3-L did not run paid AI generation or Naver draft-save.
   That requires a separate explicit paid-test gate naming provider, model, action, and expected cost.
```

Recommended handling:

```text
If support visibility is prioritized before rollout, add a small R3-M patch that sends a compact
local_state summary in heartbeat diagnostics and allows the server to sanitize/store it.

If user-facing runtime stability is prioritized, the current R3-L no-paid gate is pass and the next
gate is the bounded paid draft-save test.
```

## Decision

R3-L no-paid final actual-test gate: PASS.

Do not deploy live yet. Next approval gate should be one of:

```text
R3-M support diagnostics patch: compact local_state in web heartbeat/error report
or
Paid draft-save gate: one short text + one image, test account only, draft save only
```
