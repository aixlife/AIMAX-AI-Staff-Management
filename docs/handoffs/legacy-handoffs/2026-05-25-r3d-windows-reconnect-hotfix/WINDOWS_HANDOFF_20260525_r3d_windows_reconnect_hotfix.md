# WINDOWS_HANDOFF_20260525_r3d_windows_reconnect_hotfix

## Goal

Fix the Windows installed-runner reconnect blocker found after the R3-C v1.0.18 deploy.

Do **not** enable `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1` during this task.

## Why this is needed

The safe test-account check was blocked:

- The installed binary reported `system.app.version=v1.0.18`.
- Public version API for Windows `current=v1.0.18` returned `update_required=false`.
- The web app still showed the previous Windows runner state as `v1.0.17`.
- A stale `aimax-local-agent.lock` could block immediate reconnect.
- No paid AI, Apify, Naver login/save/publish, or job execution was run.

This means the next gate is **Windows local-agent reconnect/heartbeat reliability**, not R3-C claim activation.

## Mac-side source delta already prepared

Two small source changes were made in the Mac canonical workspace:

1. `packaging/windows/aimax_agent_launcher.go`
   - Changed the native launcher request file from:
     - `aimax-local-agent.request.json`
   - to the Python runtime's watched path:
     - `aimax-local-agent-request.json`

2. `local_agent/single_instance.py`
   - Added legacy request-file compatibility so the Python runtime reads both:
     - `aimax-local-agent-request.json`
     - `aimax-local-agent.request.json`

Reason: previous Windows native launcher and Python runtime used different request filenames. If a runner was already running, the launcher could write a connect/open-settings request that the Python runtime never saw.

## Windows task

Work in a local Windows work folder. Do not build inside Syncthing.

1. Copy the current source/patch from this handoff folder into a local Windows work folder.
2. Apply or verify the request-file fix:
   - `packaging/windows/aimax_agent_launcher.go` must use `aimax-local-agent-request.json`.
   - `local_agent/single_instance.py` must read both the canonical and legacy request paths.
3. Investigate and fix stale lock handling:
   - If `aimax-local-agent.lock` contains a PID that is not running, the next launch must not silently exit as "already running".
   - Prefer a safe Windows-only retry path:
     - detect dead PID from the lock file,
     - remove or overwrite the stale lock,
     - retry `acquire_single_instance_lock()` once,
     - never kill a live process.
4. Rebuild Windows installed runner as the next patch version, recommended `v1.0.19`.
5. Run no-paid, no-job, no-Naver-mutation verification only.

## Required verification

Use a safe non-customer test account only. Do not write the email/password to Syncthing, reports, terminal output, screenshots, `.env`, or source files.

Pass criteria:

- Web login succeeds with the safe test account.
- Installed Windows runner reports `v1.0.19` or the chosen patch version in diagnostics.
- `GET /api/version?platform=windows&current=<patch-version>` returns `update_required=false` after deploy/version metadata is updated.
- Web dashboard for the same test account reflects a fresh Windows runner heartbeat from the installed runner.
- The update-required banner clears for that account/environment.
- `aimax://agent/connect` reaches the already-running Python runtime via the request file.
- `aimax://agent/open-settings` reaches the already-running Python runtime via the request file.
- Stale lock scenario is covered:
  - create or leave a dead-PID lock file,
  - launch runner,
  - runner recovers without job execution.
- No job is created.
- No job is claimed.
- No paid AI, Apify, or Naver mutation occurs.

## Return artifacts

Return these to this same shared folder:

- `WINDOWS_RESULT_20260525_r3d_windows_reconnect_hotfix.md`
- `aimax_r3d_windows_reconnect_diag.json`
- rebuilt installer or exact artifact path/hash if build succeeds
- SHA256 sums for rebuilt artifacts

The result report must state one of:

- `pass`
- `blocked`

If blocked, include the narrowest remaining blocker:

- launcher request file still not delivered
- Python lock recovery still fails
- session/account mismatch suspected
- server/web status selection issue suspected
- other, with sanitized evidence

## Safety constraints

- Do not enable R3-C claim flag.
- Do not run paid AI/API generation.
- Do not run Apify.
- Do not log into Naver or save/publish/schedule anything.
- Do not use customer credentials.
- Redact local username, test account identity, tokens, cookies, passwords, and raw logs.
