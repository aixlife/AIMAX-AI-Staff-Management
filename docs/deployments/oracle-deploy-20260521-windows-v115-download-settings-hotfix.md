# Oracle Deploy 20260521 Windows v1.0.15 Download + Settings Hotfix

## Summary

Deployed Windows AIMAX Local Agent `v1.0.15` and the matching Oracle web hotfix files.

This release follows Windows `v1.0.14` and adds:

- direct download ticket flow so the browser download starts promptly instead of buffering the full Windows installer in JavaScript
- clearer download opening state and unsigned installer warning guidance
- local settings command status polling
- `aimax://agent/open-settings` fallback
- Windows local-agent startup/single-instance handling for `open_settings`

## Source Return

- Shared-Bridge folder:
  - `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-v115-download-settings-hotfix`
- Completion report:
  - `WINDOWS_COMPLETION_20260521_v115_download_settings_hotfix.md`
- Returned installer:
  - `aimax-bundle-windows.exe`
- Returned source files:
  - `source-files/oracle/aimax-reports-api/server.js`
  - `source-files/oracle/aimax-reports-api/static/app.html`
  - `source-files/local_agent/runtime.py`
  - `source-files/app.py`
  - `source-files/split_version/app.py`

## Artifact

- Local returned artifact:
  - `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-v115-download-settings-hotfix/aimax-bundle-windows.exe`
- Remote:
  - `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
- SHA256:
  - `daf0451d9e9f372e5509d78feac143bcb1d084ddbe1bada3019f81fc20f75def`

## Web Files

- `server.js` SHA256:
  - `59457cb6087d1072a8dbc34a0f6f446ddc83c7a01a005cc9acf3218598ec8346`
- `static/app.html` SHA256:
  - `160c7aaf00fd212a3b565e10a9803750a614f35123fb633182ab556cf2a6677d`

These match the earlier Mac/Oracle deploy-request web hotfix files.

## Backups

- Previous Windows installer backup:
  - `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe.v1.0.14.backup-20260521-v115-download-settings-hotfix`
  - SHA256: `b30183fae963f861fbe876ab5be4e120192c015663736404801f06fcf595fa5b`
- Previous web files:
  - `/home/ubuntu/aimax-reports-api/server.js.v1.0.14.backup-20260521-v115-download-settings-hotfix`
  - `/home/ubuntu/aimax-reports-api/static/app.html.v1.0.14.backup-20260521-v115-download-settings-hotfix`
- Environment backup:
  - `/home/ubuntu/aimax-reports-api/.env.bak-20260521-v115-download-settings-hotfix`

## Version API

- Windows `current=v1.0.14` -> latest/min `v1.0.15`, `update_required=true`
- Windows `current=v1.0.15` -> `update_required=false`
- macOS remains latest/min `v1.0.9`

Release notes:

```text
Windows 다운로드가 즉시 시작되도록 개선하고 로컬 설정 창 열기/대기 안내를 보강한 업데이트입니다.
```

## Verification

Windows-returned verification:

- installer ProductVersion `1.0.15`
- frozen diagnostics: `v1.0.15`, frozen `true`, `ai_text_import_smoke.ok=true`
- `V115_DOWNLOAD_SETTINGS_STATIC_OK`
- `V115_DOWNLOAD_TICKET_COMMAND_SMOKE_OK=true`
- `V113_LOGIN_IME_GUARD_OK`
- `V114_LOCAL_SETTINGS_UX_OK`
- `EDITOR_IMAGE_PROVIDER_CONTRACT_OK`
- `V110_NO_PAID_EDITOR_SMOKE_OK`
- packaged Songi media tools present
- packaged Songi entitlement/no-paid guard passed

Oracle verification after deploy:

- `node --check server.js`: passed
- service status: `active`
- remote Windows installer SHA matches returned artifact
- remote `server.js` and `static/app.html` SHA match returned source files
- public `/api/version` confirms Windows `v1.0.15`
- public `/app` contains:
  - `api/downloads/tickets`
  - `waitForAgentCommand`
  - `다운로드 여는 중`
  - `open-settings`
- unauthenticated `POST /api/downloads/tickets` now returns `401 invalid_session`, confirming the route exists and is no longer `404 not_found`
- Windows live app check report received:
  - `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-v115-download-settings-hotfix/WINDOWS_AI_STATUS_20260521_v115_live_app_check.md`
  - Confirmed the same live `/app` markers and public version API behavior.
  - Raised one remaining question: whether the live Oracle `DOWNLOAD_DIR` contains `aimax-bundle-windows.exe`.
- Oracle download path follow-up:
  - `AIMAX_DOWNLOAD_DIR` is `/home/ubuntu/aimax-downloads`
  - `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe` exists
  - size `136703476`
  - SHA256 `daf0451d9e9f372e5509d78feac143bcb1d084ddbe1bada3019f81fc20f75def`
- Synthetic logged-in download-ticket smoke:
  - created a temporary synthetic bundle account, set password through setup flow, logged in, created a download ticket, read one byte from the ticket URL, then deleted the account and revoked its session
  - ticket creation: `ok=true`
  - ticket URL shape: `/api/downloads/agent?ticket=...`
  - ticket download status: `200`
  - content length: `136703476`
  - content type: `application/octet-stream`
  - content disposition filename header: present
  - cleanup: temporary account deleted and `1` session revoked

Local source sync:

- copied returned source files into the local workspace
- `node --check oracle/aimax-reports-api/server.js`: passed
- `venv/bin/python -m py_compile app.py split_version/app.py local_agent/runtime.py`: passed
- app HTML embedded script syntax check: passed
- local source SHAs match the returned source-file SHAs.

## Safety

- No paid AI/provider generation call was made.
- No Apify Actor run was made.
- No real Naver publish/save/draft action was performed.
- No customer data, passwords, cookies, API keys, `.env`, browser profiles, setup links, signed URLs, or raw private logs were placed into Shared-Bridge artifacts.

## Residual Risk

- The Windows installer is still unsigned, so browser/SmartScreen reputation warnings can still appear. This hotfix makes the download start promptly and explains the warning; it does not replace code signing.
- Users on Windows `v1.0.14` or older must install the mandatory `v1.0.15` update to receive the local-agent `open-settings` protocol fix.
