You are the Windows AI developer for AIMAX.

First read the latest handoff docs in this Shared-Bridge folder, especially:

- `WINDOWS_HANDOFF_20260602_runner_start_timeout_windows_rebuild.md`
- `WINDOWS_PATCH_20260602_runner_start_timeout_stage_tracking.diff`

Goal: rebuild/verify the Windows runner `runner_start_timeout` hardening without paid API usage.

Important constraints:

- Copy source out of Syncthing/Shared-Bridge into a local Windows work folder before editing/building.
- Do not build inside the shared folder.
- Keep secrets, passphrases, cookies, keychains, `.env`, session files, customer data, and signed URLs out of Syncthing.
- Do not blindly overwrite the latest Windows source with the Mac folder. Mac canonical version is stale at `v1.0.36`; production Windows is `v1.0.39`.
- Apply the provided patch to the latest Windows source that produced `v1.0.39`.
- If rebuilding for users, bump Windows runner to the next version, suggested `v1.0.40`.
- Do not run paid AI generation, Apify, YouTube Data API, Naver publish/schedule/edit/save, customer credentials, or duplicate paid retries.

Required checks:

1. `python -m py_compile app.py local_agent/runtime.py`
2. Run the existing no-paid fake/headless runner polling smoke if available.
3. Confirm normal fake job updates include `claimed -> queued_to_ui -> worker_thread_started -> worker_running`.
4. Confirm a forced `remote_job` dispatch failure immediately reports `stage=ui_dispatch_error` and `error=local_ui_dispatch_error`.
5. If you build an installer/exe, return artifact filename, size, SHA256, version, and exact build command.

Return a `WINDOWS_RESULT_20260602_runner_start_timeout_rebuild.md` report to this folder with completion/blockers, verification evidence, and whether Oracle upload/version API is ready.
