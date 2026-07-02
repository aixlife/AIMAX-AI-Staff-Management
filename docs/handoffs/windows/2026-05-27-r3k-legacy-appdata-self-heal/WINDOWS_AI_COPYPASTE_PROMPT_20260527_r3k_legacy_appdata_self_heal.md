You are the Windows AIMAX developer for R3-K Legacy AppData Self-Heal.

Read this folder first:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-27-r3k-legacy-appdata-self-heal
```

On Windows, copy the entire folder out of Syncthing into a local work folder.
Do not build or run tests inside the shared folder. Do not place secrets,
`.env`, cookies, browser profiles, DPAPI material, or raw private logs into
Syncthing.

Read:

```text
WINDOWS_HANDOFF_20260527_r3k_legacy_appdata_self_heal.md
```

Task:

Implement R3-K on top of the current Windows R3-J source without regressing
R3-I/R3-J behavior.

Target Windows version:

```text
v1.0.26
```

Core behavior:

```text
Detect %APPDATA%\NaverBlog*/naverblog*
Detect stale AIMAX local-agent request files
Include system.local_state in diagnostics/error reports
Provide hidden CLI repair:
  --repair-local-state <output-json>
  --repair-local-state-dry-run
  --repair-local-state-stale-seconds
Quarantine by move/rename only
Never hard-delete user data
Keep lock file diagnostic-only
```

Use `source-files/` as reference. Do not blindly overwrite Windows files if
they contain R3-J deltas. Port the R3-K changes carefully.

Required no-paid verification:

```text
python -m py_compile aimax_compliance.py split_version\aimax_compliance.py app.py split_version\app.py diagnostics\system_info.py local_agent\state_repair.py scripts\smoke_legacy_appdata_self_heal.py
python scripts\smoke_legacy_appdata_self_heal.py
python scripts\smoke_local_settings_preserve_secrets.py
```

Synthetic Windows AppData verification:

1. Create a temporary `APPDATA` root.
2. Create `%APPDATA%\NaverBlogAuto`, `%APPDATA%\naverblog-old`, and
   `%APPDATA%\AIMAX` with stale/fresh request files and a lock file.
3. Run diagnostics probe and confirm `system.local_state.legacy_candidate_count`
   is at least 2.
4. Run repair dry-run and confirm nothing moves.
5. Run repair and confirm legacy folders and stale request file move under
   `%APPDATA%\AIMAX\local_state_quarantine\...`, fresh request remains, and lock
   file remains.

Frozen/install verification:

```text
Build aimax-bundle-windows.exe
version v1.0.26
frozen runtime true
ai_text_import_smoke.ok true
browser_version_detection.ok true
system.local_state exists in diagnostics probe
installer does not hit DeleteFile failed code 5/access denied
heartbeat/version payload reports v1.0.26
current=v1.0.26 update_required=false
aimax://agent/connect reaches v1.0.26 runtime
aimax://agent/open-settings reaches v1.0.26 runtime
local security settings save reaches command done
stale/dead PID lock recovery still passes
```

Forbidden:

```text
No paid AI/OpenAI/Gemini/Claude/image calls.
No Apify.
No Naver publish/schedule/edit/save.
No customer credentials.
No live deployment.
No Oracle version API changes.
```

Return these files to the shared folder:

```text
WINDOWS_RESULT_20260527_r3k_legacy_appdata_self_heal.md
aimax_r3k_v126_legacy_appdata_self_heal_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260527_r3k_legacy_appdata_self_heal.json
```

The result verdict must be exactly `pass` or `blocked`. If blocked, state the
narrow blocker and include the smallest failing evidence.
