Read first:

`shared-bridge\20_Deploy-To-Windows\2026-05-21-v113-login-ime-guard\WINDOWS_COMPLETION_20260521_v113_login_ime_guard.md`

Then read:

`shared-bridge\20_Deploy-To-Windows\2026-05-21-v114-local-settings-ux\WINDOWS_HANDOFF_20260521_v114_local_settings_ux.md`

Task:

Build Windows AIMAX unified installer `v1.0.14` by merging the local settings UX and key persistence fixes from the reference files in:

`shared-bridge\20_Deploy-To-Windows\2026-05-21-v114-local-settings-ux\source-files`

Important:

- Copy the source files out of Syncthing into a local Windows work folder before editing/building.
- Do not build inside the shared folder.
- Preserve all v1.0.13 login IME guard behavior.
- Do not overwrite Windows metadata blindly. Bump Windows to `v1.0.14`.
- Do not send, print, or upload secrets, API keys, cookies, `.env`, browser profiles, signed URLs, or raw private logs.
- Do not run paid AI calls, Apify Actor runs, or real Naver publish/save/draft tests.
- Use fake test values only and assert booleans/counts, never raw environment key values.

Required checks:

```powershell
python -m py_compile web_agent\client.py app.py split_version\app.py local_agent\runtime.py aimax_compliance.py split_version\aimax_compliance.py
python verify_v113_login_ime_guard.py
python scripts\verify_editor_image_provider_contract.py
```

Add or run no-paid checks for:

- damaged legacy base64 password does not crash `load_settings()`
- blank saved secret creates a cleared marker and does not auto-restore from fallback
- fake secret saves and reloads
- `AIMAX_AGENT_COMMAND_POLL_SECONDS` exists in both app files
- local settings dialog source has resizable window, scrollbar, API key guide button, and `settings_recoverer`

Build:

- unified installer file: `aimax-bundle-windows.exe`
- installer product version: `1.0.14`
- frozen diagnostics version: `v1.0.14`

Return to:

`shared-bridge\20_Deploy-To-Windows\2026-05-21-v114-local-settings-ux`

Return files:

- `WINDOWS_COMPLETION_20260521_v114_local_settings_ux.md`
- `aimax-bundle-windows.exe`
- `SHA256SUMS.txt`
- any new v1.0.14 verification script

The completion report must say whether small-screen/local settings save-button visibility was checked and confirm no paid AI/API/Naver tests were run.

