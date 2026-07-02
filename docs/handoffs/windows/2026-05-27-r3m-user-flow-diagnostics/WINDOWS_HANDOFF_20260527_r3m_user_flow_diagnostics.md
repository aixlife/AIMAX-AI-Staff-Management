# Windows Handoff - R3-M User-Flow Diagnostics

Date: 2026-05-27 KST

## Goal

Port and verify R3-M on Windows after Mac-side actual user-flow testing.

R3-M adds compact local-state diagnostics to the Local Agent heartbeat so the
web app / error-report environment can show whether a user's runner has legacy
local-state conflicts, without exposing raw paths, secrets, cookies, tokens, or
browser profiles.

## Current Mac State

Mac candidate:

```text
version: v1.0.17
installed app: /Applications/AIMAX.app
staged installer: dist/upload_installers/aimax-bundle-macos.dmg
sha256: b13a9eff47378af827fcb8c0d8207661d5ac06f4b75eebcefcab3eae2ae6db77
```

Mac actual user-flow result:

```text
demo account web UI loaded
report attention prompt appeared and was dismissed with "later" only
dashboard agent status: connected
dashboard agent version: v1.0.17
settings agent status: connected
settings agent version: v1.0.17
updates status: latest state
updates current version: v1.0.17
no paid AI, Apify, Naver mutation, customer credentials, or live deploy
```

Important: live Oracle server has not been updated yet, so production web status
does not expose `diagnostics.local_state` until the server patch is deployed.
Mac-side local server smoke verified the sanitizer contract.

## Source Changes To Port

Use the files in `source-files/` as the Mac-side reference. Port carefully into
your current Windows source without losing R3-I/R3-J/R3-K fixes.

Key changes:

```text
app.py / split_version/app.py
- Add _collect_web_agent_diagnostics()
- Add readiness.diagnostics to _collect_web_agent_readiness()
- Include compact local_state only:
  - available
  - repair_available
  - repair_strategy
  - legacy_candidate_count
  - stale_request_count
  - lock_file_action
  - request_files[] with name/exists/stale/repair_action/age_seconds only
- Do not send full paths, secrets, cookies, tokens, or raw logs.

oracle/aimax-reports-api/server.js
- Extend sanitizeAgentDiagnostics() with local_state
- Add sanitizeLocalStateDiagnostics()
- Ensure paths are not returned in public agent status.

aimax_compliance.py / split_version/aimax_compliance.py
- Mac is v1.0.17
- Windows target should be v1.0.27 unless your local release policy requires an explicitly stated patch version.
```

## Windows Target

```text
Windows version: v1.0.27
installer: aimax-bundle-windows.exe
```

Do not deploy live. Do not change Oracle version API.

## Required Windows Verification

Run direct Windows tests. Do not rely on the user manually checking.

Pass criteria:

```text
1. py_compile passes for changed Python files.
2. server.js syntax check passes.
3. Local agent heartbeat includes readiness.diagnostics.local_state.
4. Local server sanitizer returns diagnostics.local_state without raw paths.
5. Installed runner is frozen and reports v1.0.27.
6. ai_text_import_smoke.ok true.
7. browser_version_detection.ok true.
8. system.local_state remains present in diagnostics.
9. legacy AppData self-heal R3-K behavior still passes.
10. local settings preserve-secrets smoke still passes.
11. R3-I/R3-J installer/liveness/open-settings/settings-save behavior still passes.
12. Installed web user-flow check:
    - safe test login succeeds
    - runner stays connected while web UI is open
    - dashboard shows connected v1.0.27
    - settings shows connected v1.0.27
    - updates shows current v1.0.27 and update_required=false
    - report attention prompt, if shown, can be dismissed with later without server mutation
13. No DeleteFile failed code 5/access denied during installer replacement.
14. aimax://agent/connect and aimax://agent/open-settings reach current v1.0.27 runtime.
15. Installer SHA256 is provided.
```

## Forbidden Actions

```text
No paid AI/OpenAI/Gemini/Claude/image calls.
No Apify calls.
No Naver publish/schedule/edit/save.
No customer credentials.
No live deploy.
No Oracle version API changes.
No secrets, .env files, raw cookies, browser profiles, DPAPI material, signed URLs, or private logs in Syncthing.
```

## Return Files

Write these files back to this shared folder:

```text
WINDOWS_RESULT_20260527_r3m_user_flow_diagnostics.md
aimax_r3m_v127_user_flow_diagnostics_diag.json
aimax-bundle-windows.exe
NEXT_TRIGGER_20260527_r3m_user_flow_diagnostics.json
```

The result should include:

```text
verdict: pass|blocked
version
installer sha256
actual installed-user-flow evidence
diagnostics.local_state sanitizer evidence
whether any report attention prompt appeared
whether any blocker remains
confirmation that forbidden actions were not performed
```
