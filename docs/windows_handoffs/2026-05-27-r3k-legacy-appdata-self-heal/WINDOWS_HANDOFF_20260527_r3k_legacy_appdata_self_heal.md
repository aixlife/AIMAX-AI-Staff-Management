# Windows Handoff - R3-K Legacy AppData Self-Heal

Date: 2026-05-27 KST

## Context

A Windows user reported that AIMAX started working again after deleting AppData
folders beginning with `naverblog`. This indicates a local runner state
conflict, not a pure server/code-flow failure.

R3-J v1.0.25 already passed. Do not lose the R3-J Windows installer/launcher and
local settings save-completion fixes while applying R3-K.

## Goal

Build and verify Windows `v1.0.26` with Legacy AppData self-heal support:

```text
Detect %APPDATA%\NaverBlog*/naverblog*
Detect stale AIMAX request files
Report local_state diagnostics
Quarantine conflicts by move/rename only
Never hard-delete user data
Keep lock file diagnostic-only
```

## Source References

This handoff includes Mac-side reference files under:

```text
source-files/
```

Important files:

```text
source-files/local_agent/state_repair.py
source-files/diagnostics/system_info.py
source-files/scripts/smoke_legacy_appdata_self_heal.py
source-files/app.py
source-files/split_version/app.py
source-files/aimax_compliance.py
source-files/split_version/aimax_compliance.py
```

Do not blindly overwrite your current Windows source if it contains R3-J deltas.
Port the R3-K changes while preserving:

```text
R3-I installer/process-close/liveness/update recognition fixes
R3-J local settings save-completion parity fixes
Windows launcher and installer behavior
```

## Required Implementation

1. Add `local_agent/state_repair.py`.
2. Update `diagnostics/system_info.py` so `collect_system_info()` includes:

```text
system.local_state
```

3. Update `app.py` and `split_version/app.py`:

```text
--repair-local-state <output-json>
--repair-local-state-dry-run
--repair-local-state-stale-seconds
```

The repair CLI must run before normal app startup and before diagnostics probe
startup. It must not acquire the normal agent single-instance lock.

4. Add `scripts/smoke_legacy_appdata_self_heal.py`.
5. Bump Windows release to:

```text
v1.0.26
```

6. Build `aimax-bundle-windows.exe`.

## Verification

Run from a local Windows work folder, not inside Syncthing.

Required no-paid checks:

```text
python -m py_compile aimax_compliance.py split_version\aimax_compliance.py app.py split_version\app.py diagnostics\system_info.py local_agent\state_repair.py scripts\smoke_legacy_appdata_self_heal.py
python scripts\smoke_legacy_appdata_self_heal.py
python scripts\smoke_local_settings_preserve_secrets.py
```

Synthetic Windows AppData test:

1. Create a temp AppData root.
2. Create:

```text
%APPDATA%\NaverBlogAuto\settings.json
%APPDATA%\naverblog-old\debug\error.html
%APPDATA%\AIMAX\aimax-local-agent-request.json
%APPDATA%\AIMAX\aimax-local-agent.request.json
%APPDATA%\AIMAX\aimax-local-agent.lock
```

3. Make one request file stale and one fresh.
4. Run diagnostics probe with `APPDATA` pointed at the temp root.
5. Run repair dry-run and verify nothing moves.
6. Run repair and verify:

```text
legacy folders moved under %APPDATA%\AIMAX\local_state_quarantine\...
stale request moved under %APPDATA%\AIMAX\local_state_quarantine\...
fresh request remains
lock file remains
no hard delete
```

Frozen/built checks:

```text
frozen runtime true
version v1.0.26
ai_text_import_smoke.ok true
browser_version_detection.ok true
system.local_state exists in diagnostics probe
```

Preserve R3-J checks:

```text
installer does not hit DeleteFile failed code 5/access denied
installed runner is frozen
heartbeat/version payload reports v1.0.26
update_required clears for current=v1.0.26
aimax://agent/connect reaches v1.0.26 runtime
aimax://agent/open-settings reaches v1.0.26 runtime
local security settings save reaches command done
stale/dead PID lock recovery still passes
```

## Forbidden Actions

Do not run:

```text
paid AI/OpenAI/Gemini/Claude/image calls
Apify
Naver publish/schedule/edit/save
customer credentials
live deployment
Oracle version API changes
```

Do not put secrets, `.env`, cookies, browser profiles, DPAPI material, or raw
private logs into Syncthing.

## Return Files

Return these to the same shared folder:

```text
WINDOWS_RESULT_20260527_r3k_legacy_appdata_self_heal.md
aimax_r3k_v126_legacy_appdata_self_heal_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260527_r3k_legacy_appdata_self_heal.json
```

The result verdict must be exactly:

```text
pass
```

or

```text
blocked
```

If blocked, report the narrow blocker and include the smallest failing evidence.
