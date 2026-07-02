# AIMAX R3-J Windows Handoff — Local Settings Save Completion Parity

Date: 2026-05-26 KST

## Current Gate

Do not deploy live.

Mac `v1.0.15` now passes the actual `open_settings -> save -> done` flow after the R3-I settings-save hang fix.
Windows `v1.0.24` already passed the installer/liveness/update-recognition gate, but it has not yet validated the final local-settings save-completion parity changes below.

## Windows Target

Build and test Windows `v1.0.25` unless you find an existing project version rule that requires a different patch version.

## Required Code Intent

Apply the same local settings completion safety now present on Mac:

Reference copies from the Mac-side source are included for comparison:

```text
reference-mac-source/local_agent_runtime.py
reference-mac-source/split_version_app.py
```

Use them as implementation references. Do not blindly overwrite Windows-only code if the Windows source has platform-specific changes.

1. `local_agent/runtime.py`
   - Headless local security settings save must not call Tk directly from a worker thread.
   - Use a `Queue` and `dialog.after(50, poll)` to return save completion to the UI loop.
   - Recovery of old local secret values should also use a queue/poll path, not worker-thread Tk calls.
   - Avoid `tk.StringVar` for headless field/status values; use `Entry.get()`, `Entry.insert()`, and `Label.configure(text=...)` to prevent Tk cleanup warnings.
   - Add duplicate-save guard when the save button is disabled.
   - Add `Enter` = save and `Escape` = cancel bindings.

2. `split_version/app.py`
   - Mirror the queue-based save-completion path for the local settings dialog.
   - Add duplicate-save guard.
   - Add `Enter` = save and `Escape` = cancel bindings.

3. Preserve R3-I fixes
   - Installer must still avoid `DeleteFile failed; code 5` on `aimax-agent-launcher.exe`.
   - Protocol `aimax://agent/connect` and `aimax://agent/open-settings` must still reach the current installed runtime.
   - Stale/dead PID lock recovery must remain intact.

## Required Windows Validation

Use only a safe/test account. Do not use customer credentials.

No paid AI, no Apify, no Naver publish/schedule/edit/save mutation.

Pass criteria:

- Version reports `v1.0.25` or the stated patch version.
- Installer over an already-running/locked launcher does not hit DeleteFile code 5/access denied.
- Installed runner launches as frozen runtime.
- Web/test account login succeeds.
- Installed runner sends fresh heartbeat for the same test account.
- Web/protocol `open-settings` reaches the current runtime.
- Local security settings window can save existing/preserved test values.
- The web command reaches `done` with a clear success log.
- No infinite loading/reopen loop after Save/Enter.
- `update_required` clears for current version.
- `ai_text_import_smoke.ok` is true.
- `browser_version_detection.ok` is true.
- No paid AI/Apify/Naver mutation/customer credentials/secrets.

## Return Files

Put these in this same Syncthing folder:

```text
WINDOWS_RESULT_20260526_r3j_local_settings_save_completion_parity.md
aimax_r3j_v125_local_settings_save_completion_parity_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260526_r3j_local_settings_save_completion_parity.json
```

The result report must include:

- final version
- final installer SHA256
- exact test account email only, no password/token
- installer overwrite/locked-launcher result
- protocol/open-settings result
- settings save command id/status
- diagnostics summary
- blocker details if anything fails
