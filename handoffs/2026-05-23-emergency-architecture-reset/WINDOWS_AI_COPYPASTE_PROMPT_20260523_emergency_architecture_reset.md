Read first:
`WINDOWS_HANDOFF_20260523_emergency_architecture_reset.md`
`docs/maintenance_reports/aimax_architecture_reset_20260523.md`
If the repo path is not available yet, read the Shared-Bridge copy:
`aimax_architecture_reset_20260523.md`

Goal:
Stabilize AIMAX Windows after the architecture reset diagnosis. Do not add new product features. Rebuild Windows vNext only after verifying that local settings no longer delete provider API keys and protocol open-settings works reliably.

Important safety rules:
- Work in a local Windows checkout/work folder, not inside Syncthing/shared-bridge.
- Do not expose or copy secrets, cookies, `.env`, browser profiles, API keys, session tokens, signed URLs, or raw private logs into shared folders.
- Do not run paid AI/API calls.
- Do not run Apify Actors.
- Do not run real Naver publish/save/draft tests.
- Use Claude/Gemini only as advisory reviewers if already available and authenticated via subscription CLI; sanitize context first.

Source package:
Use `source-files-emergency-architecture-reset-20260523.zip` from the handoff folder. Apply the included files to the Windows work copy:
- `app.py`
- `split_version/app.py`
- `local_agent/runtime.py`
- `local_agent/single_instance.py`
- `oracle/aimax-reports-api/static/app.html`
- `scripts/smoke_local_settings_preserve_secrets.py`
- `scripts/ops_snapshot_sanitized.py`
- `docs/maintenance_reports/aimax_architecture_reset_20260523.md`

Expected version:
- If current Windows public build is v1.0.17, rebuild as v1.0.18.

Checks to run:
1. Python compile for app/local agent files.
2. `node --check oracle\aimax-reports-api\server.js`
3. Embedded app.html script syntax check.
4. `python scripts\smoke_local_settings_preserve_secrets.py`
5. `node scripts\smoke_user_secrets.mjs`
6. `node scripts\smoke_local_secret_import.mjs`
7. `node scripts\smoke_yunmi_access_gate.mjs`
8. `python scripts\headless_agent_polling_smoke.py`
9. Existing Windows no-paid editor smoke, if present.
10. Installed smoke:
    - launch/connect
    - `aimax://agent/open-settings`
    - local settings save preserves existing fake provider keys
    - IME/password input guard
    - no web infinite loading after settings completion

Architecture constraints:
- Blog Team can require the local agent because of Naver browser automation.
- Songi must remain web-first. Do not make Songi require the local agent.
- Yunmi is a web module/beta path. Do not hide or expose it by accidental local-agent readiness logic.
- Provider API keys should move toward web encrypted storage. The local security settings window must not clear or own provider keys.

Return files to the same shared folder:
- `WINDOWS_COMPLETION_20260523_emergency_architecture_reset.md`
- Installer artifact or exact artifact path
- SHA-256
- Smoke summary
- Any blockers
- Whether Blog Team, Songi, or Yunmi were affected

Final gate:
Do not mark this complete unless provider key preservation and protocol open-settings both pass on Windows.
