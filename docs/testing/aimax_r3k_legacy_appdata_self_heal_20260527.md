# AIMAX R3-K Legacy AppData Self-Heal Test Notes

Date: 2026-05-27 KST

## Purpose

R3-K addresses a Windows user-reported recovery case:

```text
Deleting AppData folders beginning with naverblog made the runner work again.
```

The product fix should not ask users to manually delete folders. It should
detect legacy local-state conflicts and quarantine them safely.

## Implemented In Mac Source

```text
local_agent/state_repair.py
diagnostics/system_info.py
app.py
split_version/app.py
aimax_compliance.py
split_version/aimax_compliance.py
scripts/smoke_legacy_appdata_self_heal.py
```

## Behavior

```text
Detect legacy AppData/Application Support folders named NaverBlog*/naverblog*
Detect stale local-agent request files
Report local_state diagnostics in error reports / diagnostics probe
Provide hidden repair CLI: --repair-local-state <output-json>
Dry-run mode: --repair-local-state-dry-run
Quarantine by move/rename only; never hard-delete
Leave lock file diagnostic-only
Do not touch Keychain, DPAPI, .env, cookies, browser profiles, or provider secrets directly
```

## Version

```text
macOS/source candidate: v1.0.16
Windows target candidate: v1.0.26
```

## No-Paid Verification

Commands:

```text
python -m py_compile aimax_compliance.py split_version/aimax_compliance.py app.py split_version/app.py diagnostics/system_info.py local_agent/state_repair.py scripts/smoke_legacy_appdata_self_heal.py
venv/bin/python scripts/smoke_legacy_appdata_self_heal.py
venv/bin/python scripts/smoke_local_settings_preserve_secrets.py
venv/bin/python app.py --diagnostics-probe /private/tmp/aimax_r3k_diag_probe.json
venv/bin/python app.py --repair-local-state /private/tmp/aimax_r3k_repair_dry_run.json --repair-local-state-dry-run
```

Results:

```text
py_compile: PASS
R3K_LEGACY_APPDATA_SELF_HEAL_OK: PASS
LOCAL_SETTINGS_PRESERVE_SECRETS_OK: PASS
diagnostics probe app version: v1.0.16
diagnostics probe ai_text_import_smoke.ok: true
diagnostics probe local_state.repair_strategy: quarantine_only_no_delete
repair dry-run: ok=true, dry_run=true
```

## Safety

```text
No paid AI calls.
No Apify calls.
No Naver publish/schedule/edit/save actions.
No customer credentials.
No live deployment.
No real local folder was moved during Mac dry-run verification.
```

## Windows Verification Required

Windows Codex must verify against synthetic Windows AppData:

```text
%APPDATA%\NaverBlogAuto
%APPDATA%\naverblog-old
%APPDATA%\AIMAX\aimax-local-agent-request.json
```

Pass criteria:

```text
diagnostics probe reports legacy_candidate_count >= 2
dry-run reports ok=true and moves nothing
repair run quarantines legacy folders under %APPDATA%\AIMAX\local_state_quarantine\...
stale request file is quarantined
fresh request file is preserved
lock file is preserved
local settings preserve-secrets smoke still passes
frozen diagnostics include local_state
no paid AI/Apify/Naver mutation/customer credentials/secrets
```

## Deployment Decision

Do not deploy R3-K live until Windows v1.0.26 returns pass evidence and Mac
candidate is built/verified.
