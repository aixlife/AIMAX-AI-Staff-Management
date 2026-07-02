You are the Windows AIMAX developer for R3-M User-Flow Diagnostics.

Read these first:

1. `WINDOWS_HANDOFF_20260527_r3m_user_flow_diagnostics.md`
2. `WINDOWS_ADDENDUM_20260527_r3n_yeri_300_word_actual_user_flow.md`
3. The files under `source-files/`

Work safely:

- Copy source out of Syncthing into your local Windows work folder.
- Do not build inside the shared folder.
- Do not put secrets, .env files, browser profiles, cookies, DPAPI material, signed URLs, or raw private logs in Syncthing.
- Preserve R3-I/R3-J/R3-K fixes while porting R3-M.
- Do not deploy live or change Oracle version API.
- Do not run paid AI, Apify, or Naver publish/schedule/edit/save.
- Do not mark this gate complete with API/smoke tests alone. Capture the real Windows web UI disabled/connected states like a user would see them.

Task:

Port R3-M compact local-state diagnostics into the Windows runner and server source:

- `app.py` / `split_version/app.py`: heartbeat readiness should include `diagnostics.local_state`.
- `oracle/aimax-reports-api/server.js`: public agent diagnostics should return a sanitized compact `local_state` summary without raw paths.
- Bump Windows target version to `v1.0.27` unless you explicitly state another patch version.
- Build `aimax-bundle-windows.exe`.

Verify directly on Windows:

1. `py_compile` changed Python files.
2. `node --check oracle/aimax-reports-api/server.js`.
3. Local heartbeat smoke proves `readiness.diagnostics.local_state` is sent.
4. Local server sanitizer smoke proves public agent status includes `diagnostics.local_state` and does not leak paths.
5. Installed runner frozen diagnostics reports `v1.0.27`.
6. `ai_text_import_smoke.ok === true`.
7. `browser_version_detection.ok === true`.
8. R3-K legacy AppData self-heal still passes.
9. R3-I/R3-J installer/liveness/open-settings/settings-save behavior still passes.
10. Installed web user-flow check passes:
    - safe test login succeeds
    - before readiness, Yeri disabled-form reason is visible and correctly explains the blocker
    - runner remains connected while web UI is open
    - dashboard shows connected `v1.0.27`
    - settings shows connected `v1.0.27`
    - updates shows current `v1.0.27` and `update_required=false`
    - if report attention prompt appears, dismiss with "later" only and record that it appeared
    - Yeri web UI/source includes the 300-char option
11. No DeleteFile failed code 5/access denied.
12. `aimax://agent/connect` and `aimax://agent/open-settings` reach the current `v1.0.27` runtime.
13. `node scripts/smoke_yeri_web_user_flow_contract.mjs` prints `YERI_WEB_USER_FLOW_CONTRACT_OK`.

Return to Syncthing:

- `WINDOWS_RESULT_20260527_r3m_user_flow_diagnostics.md`
- `aimax_r3m_v127_user_flow_diagnostics_diag.json`
- `aimax-bundle-windows.exe`
- `NEXT_TRIGGER_20260527_r3m_user_flow_diagnostics.json`

In the result, include verdict, version, installer SHA256, direct installed-user-flow evidence, disabled-form reason evidence, 300-char option evidence, local_state sanitizer evidence, prompt behavior, and confirmation that no forbidden paid/live/customer/Naver actions were performed.
