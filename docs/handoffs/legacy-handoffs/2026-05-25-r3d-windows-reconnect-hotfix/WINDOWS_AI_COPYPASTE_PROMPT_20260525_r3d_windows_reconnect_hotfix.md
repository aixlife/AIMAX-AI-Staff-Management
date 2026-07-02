You are the Windows Codex developer for AIMAX.

Task: R3-D Windows reconnect hotfix after R3-C v1.0.18 test-account check was blocked.

Read first:

1. `C:\Users\likim\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-05-25-r3d-windows-reconnect-hotfix\WINDOWS_HANDOFF_20260525_r3d_windows_reconnect_hotfix.md`
2. Previous blocked result:
   `C:\Users\likim\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-05-25-r3c-windows-test-account-agent-check\WINDOWS_RESULT_20260525_r3c_windows_test_account_agent_check.md`
3. Previous diagnostics:
   `C:\Users\likim\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-05-25-r3c-windows-test-account-agent-check\aimax_r3c_v118_test_account_diag.json`

Important context:

- R3-C claim flag must remain OFF.
- Do not enable `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1`.
- Do not run paid AI/API generation.
- Do not run Apify.
- Do not log into Naver or save/publish/schedule anything.
- Do not use customer credentials.
- Safe test-account password must never be written to Syncthing, report files, terminal logs, `.env`, source, or screenshots.

Known finding from Mac-side source review:

- `packaging/windows/aimax_agent_launcher.go` wrote requests to `aimax-local-agent.request.json`.
- Python runtime watches `aimax-local-agent-request.json`.
- This filename mismatch can make `aimax://agent/connect` and `aimax://agent/open-settings` fail to reach an already-running Python runtime.
- Mac canonical source has been patched so the Go launcher uses the hyphen filename and Python reads both canonical and legacy filenames.

Your Windows task:

1. Copy source/patches from Syncthing into a local Windows work folder. Do not build inside the shared folder.
2. Verify/apply:
   - `packaging/windows/aimax_agent_launcher.go`: `requestFileName = "aimax-local-agent-request.json"`
   - `local_agent/single_instance.py`: reads both `aimax-local-agent-request.json` and `aimax-local-agent.request.json`
3. Add/verify stale-lock recovery:
   - If `aimax-local-agent.lock` contains a dead PID, the next launch must recover and acquire the lock.
   - Never kill a live process.
   - Retry lock acquire once after safe stale cleanup.
4. Rebuild Windows runner as the next patch version, recommended `v1.0.19`.
5. Run no-paid verification:
   - public version endpoint after deploy/version metadata update
   - installed diagnostics show patch version
   - safe test-account web login succeeds
   - installed runner connects and sends fresh heartbeat for that test account
   - dashboard/update-required banner clears
   - `aimax://agent/connect` and `aimax://agent/open-settings` reach the already-running runtime
   - dead-PID lock file recovery works
   - no job created/claimed/executed
   - no paid AI, Apify, or Naver mutation

Return to:

`C:\Users\likim\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-05-25-r3d-windows-reconnect-hotfix\`

Required return files:

- `WINDOWS_RESULT_20260525_r3d_windows_reconnect_hotfix.md`
- `aimax_r3d_windows_reconnect_diag.json`
- rebuilt artifact path/hash or installer file if build succeeds
- SHA256 sums

Report verdict must be exactly `pass` or `blocked`.

If blocked, identify the remaining blocker as specifically as possible:

- launcher request file not delivered
- Python stale lock recovery still fails
- session/account mismatch suspected
- server/web status selection issue suspected
- other sanitized evidence
