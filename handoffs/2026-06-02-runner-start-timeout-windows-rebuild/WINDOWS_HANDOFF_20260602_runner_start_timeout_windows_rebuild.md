# Windows Handoff - runner_start_timeout hardening rebuild

Date: 2026-06-02 KST
From: Mac/Oracle Codex
To: Windows AI developer

## Background

I reviewed the completed Windows status report:

- Shared-Bridge source report: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-06-02-runner-start-timeout-windows-fix/WINDOWS_AI_STATUS_20260602_runner_start_timeout_windows_fix.md`
- Related report ID: `AIMAX-RPT-20260601143313-9085ebda`
- Production symptom: `runner_start_timeout` / `local_worker_not_started_after_claim`
- Current reported Windows runner version: `v1.0.39`

The status report correctly classifies this as a Windows runner issue: the web/API server already delivered and claimed the job, but the local runner did not reach worker start within the watchdog window.

## Mac-side source alignment now done

The local Mac canonical source did not contain the status report patch yet. I aligned the source with the reported fix and added one server-side sanitizer support change so the new diagnostics are preserved in web error reports.

Changed source files:

- `app.py`
  - Active web-agent job stage tracking:
    - `claimed`
    - `queued_to_ui`
    - `ui_received`
    - `worker_start_requested`
    - `worker_thread_started`
    - `worker_running`
    - `ui_dispatch_error`
  - More specific timeout failure codes:
    - `local_ui_queue_not_processed_after_claim`
    - `local_worker_not_started_after_claim`
  - Immediate failed job update if `remote_job` UI/headless queue dispatch throws.
  - Active job diagnostics include id, kind, stage, age seconds, latest stage error.
- `local_agent/runtime.py`
  - Headless queue now fails a claimed `remote_job` immediately if dispatch throws instead of letting the polling watchdog time out.
  - Headless shutdown clears active job diagnostics.
- `oracle/aimax-reports-api/server.js`
  - Sanitizer now preserves polling diagnostics fields:
    - `active_job_kind`
    - `active_job_stage`
    - `active_job_age_seconds`
    - `active_job_latest_stage_error`

Verification already run on Mac:

- `python -m py_compile app.py local_agent/runtime.py` passed.
- `node --check oracle/aimax-reports-api/server.js` passed.
- No-paid headless fake API smoke passed. Observed sequence:
  - `claimed`
  - `queued_to_ui`
  - `worker_thread_started`
  - `worker_running`
  - final `done` or forced `failed`
- No-paid dispatch-failure smoke passed with:
  - `stage=ui_dispatch_error`
  - `error=local_ui_dispatch_error`

## Important source/version warning

Do not blindly build from the Mac folder as a full source overwrite.

The Mac canonical `aimax_compliance.py` still says `APP_VERSION = "v1.0.36"`, while production Windows is already `v1.0.39`. Apply the provided patch to the latest Windows working source that produced `v1.0.39`, then bump Windows to the next release version if you rebuild for users. Suggested next Windows version: `v1.0.40`.

## Patch artifact

Use the explicit patch in this same folder:

- `WINDOWS_PATCH_20260602_runner_start_timeout_stage_tracking.diff`

Apply it to the latest Windows source/work folder, not inside Syncthing.

## Windows task

1. Read this handoff and the earlier completed status report first.
2. Copy the source/work folder out of Syncthing into a local Windows work directory.
3. Do not build inside the Shared-Bridge/Syncthing folder.
4. Keep secrets, passphrases, session files, keychains, cookies, `.env`, and customer data out of Syncthing.
5. Apply `WINDOWS_PATCH_20260602_runner_start_timeout_stage_tracking.diff` to the latest Windows source that produced `v1.0.39`.
6. If releasing, bump Windows runner version to the next production version, suggested `v1.0.40`.
7. Run no-paid verification first.
8. Build the Windows runner only after no-paid checks pass.
9. Return evidence and artifacts to this Shared-Bridge folder.

## Required no-paid verification

Run at minimum:

- `python -m py_compile app.py local_agent/runtime.py`
- Existing fake/headless runner polling smoke, if available in the Windows source:
  - `python scripts/headless_agent_polling_smoke.py`
- A dispatch-failure check confirming a claimed `remote_job` failure reports immediately with:
  - `stage=ui_dispatch_error`
  - `error=local_ui_dispatch_error`
- Confirm a normal fake job update sequence includes:
  - `claimed`
  - `queued_to_ui`
  - `worker_thread_started`
  - `worker_running`

Do not run paid AI generation, Apify, YouTube Data API, Naver publish/schedule/edit/save, customer credentials, or duplicate paid retries.

## Optional installed-runner smoke

After rebuild, if you can test with an installed Windows runner without paid model usage:

1. Install/run the rebuilt Windows runner.
2. Connect it to the web app with the approved test account/session.
3. Confirm the web UI sees the new version.
4. Confirm heartbeat/readiness diagnostics include active job fields when a fake or safe local job is exercised.

A real Yeri job that generates content may call paid AI APIs. Run that only after the owner explicitly approves provider, model, action, max cost, account, input size, output target, and retry/resume rule.

## Return expectations

Return these to the Shared-Bridge folder:

- `WINDOWS_RESULT_20260602_runner_start_timeout_rebuild.md`
- no-paid command outputs
- screenshots or visible text evidence if an installed runner was opened
- built artifact name, size, SHA256, and version if you build
- whether Oracle installer upload/version API change is ready or blocked
- whether report `AIMAX-RPT-20260601143313-9085ebda` can remain open or is ready for post-deploy verification

Do not mark `AIMAX-RPT-20260601143313-9085ebda` complete until a rebuilt Windows runner containing this patch is deployed and verified.
