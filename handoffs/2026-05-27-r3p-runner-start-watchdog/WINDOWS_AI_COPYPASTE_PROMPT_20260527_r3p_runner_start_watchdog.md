# Copy/Paste Prompt - Windows R3-P Runner Start Watchdog

You are the Windows AIMAX developer. Work on R3-P runner-start watchdog only.

Read first:

1. `WINDOWS_HANDOFF_20260527_r3p_runner_start_watchdog.md`
2. Previous R3-M/R3-O result in the same project context, especially the blocker `runner_claim_after_delivery_timeout` for job `9f282e93-7ca7-402b-8965-85c95ea14b52`.

Rules:

- Copy the Syncthing folder to a local Windows work folder before editing/building.
- Do not build inside Syncthing.
- Keep secrets/passphrases/cookies/browser profiles out of Syncthing.
- Do not deploy live.
- Do not change Oracle version API.
- Do not run paid AI, Apify, Naver publish/schedule, customer credentials, or duplicate paid retry.

Apply source files:

- `source-files/app.py` -> repo root `app.py`
- `source-files/runtime.py` -> `local_agent/runtime.py`
- `source-files/server.js` -> `oracle/aimax-reports-api/server.js`
- `source-files/smoke_runner_start_timeout.mjs` -> `scripts/smoke_runner_start_timeout.mjs`

Version:

- Build Windows as `v1.0.28`, or explicitly state the patch version if different.

No-paid verification:

1. Python compile `app.py` and `local_agent/runtime.py`.
2. Node syntax check `oracle/aimax-reports-api/server.js`.
3. Run `node scripts/smoke_runner_start_timeout.mjs`.
4. Re-run the existing no-paid R3-I/R3-J/R3-K/R3-M checks for installer/liveness/update recognition/open-settings/settings-save/legacy AppData/local settings preserve-secrets/ai text import/browser version detection.
5. Build and install `aimax-bundle-windows.exe`.
6. Verify installed runner version, frozen runtime, protocol connect/open-settings, and no DeleteFile code 5/access denied.
7. Open production web UI in a visible browser and confirm demo account dashboard/settings show the installed Windows runner connected/current. Do not create a new paid Yeri job.

Return:

- `WINDOWS_RESULT_20260527_r3p_runner_start_watchdog.md`
- `aimax_r3p_v128_runner_start_watchdog_diag.json`
- `aimax-bundle-windows.exe`
- `NEXT_TRIGGER_20260527_r3p_runner_start_watchdog.json`

Pass criteria:

- Delivered-but-not-started jobs become `failed` with `runner_start_timeout`, not infinite `running`.
- Started jobs are not falsely timed out.
- Installed Windows runner emits claim ACK and start evidence.
- All previous no-paid behavior remains passing.
- No paid AI/Apify/Naver mutation/live deploy/Oracle version API change.

If blocked, report the narrow blocker and do not substitute an API-only or source-mode test for an installed-runner check.

