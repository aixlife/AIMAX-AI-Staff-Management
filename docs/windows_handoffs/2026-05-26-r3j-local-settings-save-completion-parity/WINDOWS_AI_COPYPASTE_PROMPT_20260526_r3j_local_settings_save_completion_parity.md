You are the Windows Codex developer for AIMAX.

Read this handoff first:

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3j-local-settings-save-completion-parity/WINDOWS_HANDOFF_20260526_r3j_local_settings_save_completion_parity.md`

Task: build and validate Windows R3-J local-settings save completion parity. Do not deploy live.

Mac-side reference copies are included:

```text
reference-mac-source/local_agent_runtime.py
reference-mac-source/split_version_app.py
```

Use them as references only. Preserve Windows-specific code and version/build conventions.

Important:

- Copy any needed source/artifacts out of Syncthing into a local Windows work folder before building.
- Do not build inside the shared folder.
- Keep secrets, passwords, passphrases, decrypted tokens, `.env`, `venv`, `build`, `dist`, caches, and private logs out of Syncthing.
- Use only safe/test account credentials that are already approved for this testing lane.
- Do not use customer credentials.
- Do not run paid AI, Apify, Naver publish/schedule/edit/save, or unlimited retries.

Implement the Windows equivalent of the Mac fix:

1. `local_agent/runtime.py`
   - The headless local security settings dialog must not call Tk from a worker thread.
   - Use `Queue` plus `dialog.after(50, poll)` for save completion.
   - Use the same queue/poll approach for recovery of missing local secrets.
   - Avoid `tk.StringVar` in the headless settings dialog; use direct `Entry` and `Label.configure`.
   - Add disabled-save guard.
   - Add `Enter` to save and `Escape` to cancel.

2. `split_version/app.py`
   - Mirror queue-based settings save completion.
   - Add disabled-save guard.
   - Add `Enter` to save and `Escape` to cancel.

3. Preserve previous Windows R3-I behavior:
   - no `DeleteFile failed; code 5` / access denied when installing over a running launcher
   - stale/dead PID lock recovery still works
   - `aimax://agent/connect` and `aimax://agent/open-settings` route to the current installed runtime
   - heartbeat/version payload reports the current version
   - `update_required` clears for the current version

Version target: `v1.0.25`, unless the Windows project versioning rule says otherwise. If different, state it clearly in the result.

Required validation:

- Build installer.
- Install over a state where the old launcher/runtime is already running.
- Confirm no DeleteFile code 5/access denied.
- Launch installed runner.
- Connect/login with the safe test account.
- Trigger web/protocol open-settings.
- Save preserved local test values using the settings window.
- Confirm command status reaches `done`.
- Confirm no infinite loading/reopen loop.
- Run no-paid installed diagnostics.
- Confirm `ai_text_import_smoke.ok=true`.
- Confirm `browser_version_detection.ok=true`.

Return these files to the shared folder:

```text
WINDOWS_RESULT_20260526_r3j_local_settings_save_completion_parity.md
aimax_r3j_v125_local_settings_save_completion_parity_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260526_r3j_local_settings_save_completion_parity.json
```

The result must include final installer SHA256 and clear PASS/BLOCKED verdict.
