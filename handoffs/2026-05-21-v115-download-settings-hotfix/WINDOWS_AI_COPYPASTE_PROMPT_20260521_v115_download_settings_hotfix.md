Read first:

`20_Deploy-To-Windows\2026-05-21-v115-download-settings-hotfix\WINDOWS_HANDOFF_20260521_v115_download_settings_hotfix.md`

Also read:

`20_Deploy-To-Windows\2026-05-21-download-settings-hotfix\MAC_ORACLE_DEPLOY_REQUEST_20260521_download_settings_hotfix.md`

Goal:

Build Windows AIMAX unified installer `v1.0.15` from the current Windows local source that already contains the download/local-settings hotfix.

Important:

- Do **not** rebuild as `v1.0.14`. `v1.0.14` is already deployed, so users would not be forced to update.
- Preserve everything from `v1.0.14`: login IME guard, safe-storage fallback, local settings UX/key persistence, editor/image-provider fix, Songi runtime/media tools, entitlement/no-paid/redaction guards.
- Add and verify the hotfix from `2026-05-21-download-settings-hotfix`.
- Mac side will handle Oracle/web deployment of the prepared `server.js` and `app.html`; Windows does not need SSH access to Oracle.
- Windows still must rebuild the installer because `local_agent/runtime.py`, `app.py`, and `split_version/app.py` changed for `aimax://agent/open-settings` / single-instance `open_settings` handling.
- Keep the packaged web runtime in the installer aligned with the prepared hotfix web files unless you intentionally supersede them and explain why.

Required checks:

```powershell
node --check oracle\aimax-reports-api\server.js
python -m py_compile app.py split_version\app.py local_agent\runtime.py
python verify_v113_login_ime_guard.py
python verify_v114_local_settings_ux.py
python scripts\verify_editor_image_provider_contract.py
python verify_v110_no_paid_editor_smoke.py
```

Also run the same checks from the prior status report:

- `APP_HTML_SCRIPT_SYNTAX_OK`
- download ticket/direct streaming smoke
- command status smoke
- `OPEN_SETTINGS_PROTOCOL_CHECK_OK`
- frozen diagnostics showing `v1.0.15`

Return to:

`C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-21-v115-download-settings-hotfix`

Return files:

- `WINDOWS_COMPLETION_20260521_v115_download_settings_hotfix.md`
- `aimax-bundle-windows.exe`
- `SHA256SUMS.txt`
- `source-files\oracle\aimax-reports-api\server.js`
- `source-files\oracle\aimax-reports-api\static\app.html`
- `source-files\local_agent\runtime.py`
- `source-files\app.py`
- `source-files\split_version\app.py`
- any verification scripts added or changed

Completion report must explicitly say:

- final installer is `v1.0.15`
- exact hotfix markers are present:
  - `downloads/tickets`
  - `waitForAgentCommand`
  - `다운로드 여는 중`
  - `aimax://agent/open-settings` or equivalent `open-settings` protocol handling
- packaged `server.js` and `app.html` match or intentionally supersede the Mac/Oracle hotfix files
- no paid calls and no secrets used

Safety:

No customer data, no `.env`, no API keys, no cookies, no browser profiles, no paid AI calls, no Apify Actor runs, no Naver publish/save/draft tests.
