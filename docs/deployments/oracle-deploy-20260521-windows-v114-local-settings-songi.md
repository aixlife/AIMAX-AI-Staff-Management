# Oracle Deploy 20260521 Windows v1.0.14 Local Settings UX + Songi

## Summary

Deployed Windows AIMAX Local Agent `v1.0.14` from the Windows completion return in Shared-Bridge.

This release combines:

- Local security settings UX and secret recovery fixes.
- Preservation of the `v1.0.13` login IME guard and safe-storage fallback fixes.
- Preservation of previous editor/image-provider contract fixes.
- Songi research employee packaging and no-paid readiness checks.

## Source Returns

- Local settings return:
  - `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-v114-local-settings-ux`
- Songi release-check return:
  - `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-songi-windows-release-check`
- Canonical returned installer:
  - `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-v114-local-settings-ux/aimax-bundle-windows.exe`

## Fixes

- Local security settings dialog is resizable/scrollable so the save controls remain reachable on smaller screens.
- Local settings load uses non-blocking/faster command polling so users are not left waiting without feedback.
- Previously saved local secrets can be recovered from the secure store when the local fallback file is empty.
- Empty local fallback records are treated as clear tombstones only when intentionally saved.
- API key guide link is exposed from the local security settings flow.
- `v1.0.13` web-login password IME guard remains in place.
- `v1.0.12` keychain/safe-storage fallback remains in place.
- `v1.0.11` editor/image-provider contract fix remains in place.
- Songi Windows packaging inputs are included and release-checked for bundle users.

## Returned Verification

- `verify_v114_local_settings_ux.py`: `V114_LOCAL_SETTINGS_UX_OK`
- Secret redaction check: `secret_values_printed=0`
- Login IME guard regression check: passed
- Editor/image-provider contract regression check: passed
- Songi release check: passed for packaged source/artifact inclusion.
- Songi entitlement check: visible for `bundle`/`blog_team`, not visible for unrelated single-worker products.
- Songi no-paid precollection checks: passed for YouTube/Instagram style flows.
- Songi paid-call guard: returned the expected paid-confirmation block before any paid provider action.
- Signed/private media URL redaction marker: passed.

## Artifact

- Local returned artifact:
  - `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-v114-local-settings-ux/aimax-bundle-windows.exe`
- Remote:
  - `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
- SHA256:
  - `b30183fae963f861fbe876ab5be4e120192c015663736404801f06fcf595fa5b`

## Backup

- Previous Windows installer backup:
  - `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe.v1.0.13.backup-20260521-v114-local-settings-songi`
- Previous SHA256:
  - `bb2510cbb994eef03ee000e17dd0a678094c02dec4228e7a351cb634f5b68b38`
- Environment backup:
  - `/home/ubuntu/aimax-reports-api/.env.bak-20260521-windows-v114-local-settings-songi`

## Version API

- Windows `current=v1.0.13` -> latest/min `v1.0.14`, `update_required=true`
- Windows `current=v1.0.14` -> `update_required=false`
- macOS `current=v1.0.9` -> `update_required=false`
- Remote Windows artifact SHA256 matches returned Shared-Bridge artifact SHA256.

## Post-Deploy Regression Checks

Mac/source no-paid checks run after the user clarified that the goal was report-specific regression verification:

- `venv/bin/python scripts/verify_editor_image_provider_contract.py`
  - `EDITOR_IMAGE_PROVIDER_CONTRACT_OK`
- Direct mocked provider routing call:
  - `EDITOR_IMAGE_PROVIDER_DIRECT_ROUTING_OK`
  - Confirms `input_content(..., image_provider="openai", fallback_api_key=...)` reaches the image route without `TypeError`.
- `AIMAX_DISABLE_KEYCHAIN=1` session fallback smoke:
  - `WEB_AGENT_SESSION_FALLBACK_AND_PASSWORD_GUARD_OK`
  - Confirms fallback session save/load/clear works without keychain, file mode is `0600`, Hangul/space password validation blocks bad input locally.
- Webapp JS storage fallback smoke:
  - `WEBAPP_SESSION_STORAGE_FALLBACK_OK`
  - Confirms blocked `localStorage` falls back to `sessionStorage`, and blocked browser storage falls back to in-memory session.
- `PYTHONPATH=. venv/bin/python .../verify_v114_local_settings_ux.py`
  - `V114_LOCAL_SETTINGS_UX_OK`
  - `modules_checked=2`
  - `secret_values_printed=0`
- `venv/bin/python -m py_compile web_agent/client.py local_agent/runtime.py app.py split_version/app.py posting/editor.py scripts/verify_editor_image_provider_contract.py`
  - passed.
- macOS packaged binary diagnostics from `dist/AIMAX/AIMAX --diagnostics-probe`
  - exit code `0`
  - `version: v1.0.9`
  - frozen runtime `true`
  - `ai_text_import_smoke.ok: true`

Production server checks:

- Remote deployed `static/app.html` session fallback and friendly error source smoke:
  - `REMOTE_WEBAPP_SESSION_AND_FRIENDLY_ERROR_SOURCE_OK`
- Public HTTPS version API:
  - Windows `v1.0.13` -> latest/min `v1.0.14`, `update_required=true`
  - Windows `v1.0.14` -> `update_required=false`
  - macOS `v1.0.8` -> latest/min `v1.0.9`, `update_required=true`
  - macOS `v1.0.9` -> `update_required=false`

Windows executable post-deploy interactive verification cannot be run on the Mac host. A dedicated Windows handoff was created for exact-environment validation:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-postdeploy-report-regression/WINDOWS_HANDOFF_20260521_postdeploy_report_regression.md`
- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-postdeploy-report-regression/WINDOWS_AI_COPYPASTE_PROMPT_20260521_postdeploy_report_regression.md`

Windows return expectation:

- direct installed `v1.0.14` frozen diagnostics
- Hangul password local rejection before HTTP login
- ASCII test login path does not fail with session safe-storage error
- local settings opens quickly and remains usable on small windows
- no-paid editor and Songi checks remain green.

Windows return received:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-21-postdeploy-report-regression/WINDOWS_COMPLETION_20260521_postdeploy_report_regression.md`
- Verdict:
  - `PASS for installed Windows v1.0.14 post-deploy no-paid regression scope`
  - One live-account blocker remains: no usable synthetic AIMAX account credentials were available, so a real web-account login was not performed.
- Installed Windows checks:
  - exact deployed installer SHA matched `b30183fae963f861fbe876ab5be4e120192c015663736404801f06fcf595fa5b`
  - public version API passed for Windows `v1.0.13` -> required update and `v1.0.14` -> no update
  - installed `AIMAX.exe --diagnostics-probe` exited `0`, reported `v1.0.14`, frozen runtime `true`, `ai_text_import_smoke.ok=true`
  - editor/image-provider checks passed, including no recurrence of `input_content() got an unexpected keyword argument 'image_provider'`
  - Hangul password pre-HTTP guard passed via scripted no-paid handler test
  - ASCII mocked login plus forced safe-storage failure passed without hard login failure
  - installed GUI local settings smoke opened in about `3881ms`, resize worked, static checks found resizable dialog, scroll canvas, footer buttons outside scroll, API guide, and fast opening feedback
  - installed Songi runtime/media tools were present
  - `bundle` had Songi access and `blog_team` did not
  - Gemini/Apify requests without `confirm_paid` returned `402 research_paid_confirmation_required`
  - sensitive/signed URL redaction passed.

Residual live-flow gap:

- A true successful web-account login on Windows still needs a disposable synthetic AIMAX test account. Customer accounts, `.env`, cookies, browser profiles, and private credential sources were intentionally not used.

## Related Error Reports

The following related reports were confirmed as completed after deploy and verification:

- `AIMAX-RPT-20260520021900-587c9a8c`
  - Windows `v1.0.9`
  - Editor `image_provider`/Smart Editor input contract mismatch.
  - Status updated to `done`.
- `AIMAX-RPT-20260520075108-ad949f22`
  - Windows `v1.0.9`
  - Internal body-input file version mismatch before blog writing started.
  - Status updated to `done`.
- `AIMAX-RPT-20260520160110-d8808095`
  - macOS `v1.0.2`
  - Safe storage session token failure.
  - Already `done` before this Windows deployment pass.

## Safety

- No paid AI/provider generation call was made in this deployment pass.
- No Apify Actor run was made in this deployment pass.
- No real Naver publish/save/draft action was performed.
- No customer data, passwords, cookies, API keys, `.env`, browser profiles, setup links, signed URLs, or raw private logs were placed into Shared-Bridge artifacts.

## Residual Risk

- The Windows installer is unsigned because no code-signing certificate was available in the Windows build environment. SmartScreen or enterprise policy may still warn or block unsigned installers.
- Real successful web-account login and real Naver publish/save flows were not executed by design. Verification used no-paid/no-secret paths and returned Windows checks.
- Users on old Windows agents must install the mandatory update before receiving these fixes locally.
