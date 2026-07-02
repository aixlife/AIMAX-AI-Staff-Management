Read:

`C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-28-r3u-yeri-explicit-server-generation-final\WINDOWS_RECHECK_REQUEST_20260528_r3u_runner_claim_after_popup_fix.md`

Task:

Verify the Windows repeated popup fix and resume the existing Yeri server artifact job. Do not create a new paid job.

Existing job to resume:

`1131624c-db33-4fab-9366-43c997a9b430`

Important:

- No new paid Gemini/server-generation call.
- Do not retry paid generation.
- Do not publish, schedule, edit, draft-save, or final-save anything to Naver unless separately approved.
- Use `demo@aimax.ai.kr`.
- Do not write, screenshot, store, echo, or include the password in any output.
- Do not expose API keys, cookies, session tokens, signed URLs, fingerprints, or browser profiles.

Required verification:

1. Confirm installed runner `v1.0.31`.
2. Confirm the repeated `aimax://agent/connect` popup/window loop is fixed:
   - run connect while runner is already running
   - at most one clear visible guidance/status window appears
   - no repeated popup loop continues
3. Confirm production agent status:
   - connected=true
   - version=v1.0.31
   - update_required=false
   - device_label=AIXLIFE (Windows)
   - yeri_write readiness ready
4. Confirm job polling is not disabled:
   - AIMAX_AGENT_HEARTBEAT_ONLY not enabled
   - AIMAX_AGENT_DISABLE_JOBS not enabled
   - no skip_jobs=true condition
5. Check runner logs/diagnostics for `[웹앱 작업]`, `next-job`, polling errors, or active job state.
6. Cleanly restart the runner if needed.
7. Wait at least 90 seconds.
8. Verify whether existing job `1131624c-db33-4fab-9366-43c997a9b430` is claimed:
   - runner_claimed_at populated, or status changes from ready_for_publish to running/done/failed.
9. If claimed, verify runner received artifact id `1131624c-db33-4fab-9366-43c997a9b430`.
10. Stop before any Naver mutation.

If still not claimed, return a narrow blocker:

- whether the runner called `/api/agent/next-job`
- HTTP status/error if visible
- runner connected/current evidence
- job polling env/flag evidence
- recent sanitized runner logs
- process list summary
- whether popup fix affected polling behavior

Return:

- `WINDOWS_RESULT_20260528_r3u_runner_claim_after_popup_fix.md`
- `aimax_r3u_runner_claim_after_popup_fix_diag.json`
- sanitized evidence JSON/screenshots if useful

Pass requires: existing job reused, no new paid AI, popup loop fixed, runner claim or precise polling blocker, no Naver mutation, no secrets.
