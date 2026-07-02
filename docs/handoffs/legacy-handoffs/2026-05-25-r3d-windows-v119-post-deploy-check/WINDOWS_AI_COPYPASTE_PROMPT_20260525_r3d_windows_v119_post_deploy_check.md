You are the Windows Codex developer for AIMAX.

Task: Post-deploy verification for live/public Windows AIMAX runner v1.0.19.

Read first:

`C:\Users\likim\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-05-25-r3d-windows-v119-post-deploy-check\WINDOWS_HANDOFF_20260525_r3d_windows_v119_post_deploy_check.md`

Context:

- Oracle live deployment has been updated to Windows `v1.0.19`.
- Expected live installer SHA256:
  `c9f5f5586b2e6005886ff4d7335e03ccc121d2493d9901f7672df0dff767e392`
- Public version policy:
  - `current=v1.0.18` -> update required
  - `current=v1.0.19` -> update not required
- `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED` must remain OFF.

Safety:

- Do not enable claim flag.
- Do not run paid AI/API generation.
- Do not run Apify.
- Do not log into Naver or save/publish/schedule anything.
- Do not create, claim, or execute jobs.
- Use safe non-customer test account only.
- Never write the test account password to Syncthing, report files, terminal output, screenshots, `.env`, source, or logs.

Your task:

1. Download/install AIMAX Windows runner from the live web app/download flow, not from a local build folder.
2. If possible, verify downloaded installer SHA256:
   `c9f5f5586b2e6005886ff4d7335e03ccc121d2493d9901f7672df0dff767e392`
3. Install v1.0.19.
4. Run installed diagnostics.
5. Log into the web app with the safe test account.
6. Start installed runner.
7. Verify the web dashboard reflects fresh Windows runner `v1.0.19`.
8. Verify update-required banner is gone.
9. Verify `aimax://agent/connect` and `aimax://agent/open-settings` reach the already-running runtime.
10. Verify stale dead-PID lock recovery if practical.
11. Confirm no job was created, claimed, or executed.

Return files to:

`C:\Users\likim\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-05-25-r3d-windows-v119-post-deploy-check\`

Required:

- `WINDOWS_RESULT_20260525_r3d_windows_v119_post_deploy_check.md`
- `aimax_r3d_v119_post_deploy_diag.json`
- installer hash evidence if available

The report verdict must be exactly `pass` or `blocked`.

If blocked, name the narrow blocker:

- live download still serves old installer
- installed diagnostics not v1.0.19
- web still shows stale runner version
- update banner still visible
- protocol connect/open-settings failure
- stale lock recovery failure
- other sanitized evidence
