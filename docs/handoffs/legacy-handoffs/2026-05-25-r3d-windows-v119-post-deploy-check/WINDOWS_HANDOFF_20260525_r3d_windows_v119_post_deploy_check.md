# WINDOWS_HANDOFF_20260525_r3d_windows_v119_post_deploy_check

## Goal

Verify the live/public Oracle deployment of Windows AIMAX runner `v1.0.19`.

This is a post-deploy check only. Do **not** enable `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1`.

## Context

Mac/Oracle side deployed:

- `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
- SHA256: `c9f5f5586b2e6005886ff4d7335e03ccc121d2493d9901f7672df0dff767e392`
- `AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.19`
- `AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.19`

Public API already verified:

- `current=v1.0.18` -> `update_required=true`
- `current=v1.0.19` -> `update_required=false`
- `/api/reports/health` -> `ok=true`, `storage.ok=true`

Deployment report:

```text
docs/deployments/oracle-deploy-20260525-r3d-windows-v119-reconnect-hotfix.md
```

## Windows task

Use a safe non-customer test account only. Do not write the email/password to Syncthing, reports, terminal output, screenshots, `.env`, or source files.

1. Download/install from the live AIMAX web app/download flow, not from a local build folder.
2. Verify the downloaded installer hash if possible:
   - expected SHA256: `c9f5f5586b2e6005886ff4d7335e03ccc121d2493d9901f7672df0dff767e392`
3. Install `v1.0.19`.
4. Run installed diagnostics.
5. Log into web app with safe test account.
6. Start installed runner.
7. Verify fresh heartbeat and dashboard state.
8. Verify `aimax://agent/connect` and `aimax://agent/open-settings` still reach the already-running runtime.
9. Verify stale dead-PID lock recovery from installed app if practical.

## Pass criteria

- Installed diagnostics show `system.app.version=v1.0.19`.
- Public version API reports `current=v1.0.19` as `update_required=false`.
- Safe test-account web login succeeds.
- Web dashboard reflects installed Windows runner `v1.0.19`.
- Update-required banner is gone.
- Runner connection does not hang.
- `aimax://agent/connect` works.
- `aimax://agent/open-settings` works.
- No job is created.
- No job is claimed.
- No paid AI, Apify, or Naver mutation occurs.
- No customer credentials are used.

## Return files

Return to this same shared folder:

- `WINDOWS_RESULT_20260525_r3d_windows_v119_post_deploy_check.md`
- `aimax_r3d_v119_post_deploy_diag.json`
- installer hash evidence if available

Verdict must be exactly:

- `pass`
- `blocked`

If blocked, identify the narrow blocker:

- live download still serves old installer
- installed diagnostics not `v1.0.19`
- web still shows stale runner version
- update banner still visible
- protocol connect/open-settings failure
- stale lock recovery failure
- other, with sanitized evidence

## Safety constraints

- Do not enable claim flag.
- Do not run paid AI/API generation.
- Do not run Apify.
- Do not log into Naver or save/publish/schedule anything.
- Do not create/claim/execute jobs.
- Do not use customer credentials.
- Redact local username, test account identity, tokens, cookies, passwords, raw logs, and private local paths.
