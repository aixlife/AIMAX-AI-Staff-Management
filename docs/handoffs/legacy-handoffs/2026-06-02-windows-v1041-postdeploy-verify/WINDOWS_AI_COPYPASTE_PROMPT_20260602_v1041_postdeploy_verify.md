You are the Windows AI developer for AIMAX. Please perform the v1.0.41 post-deploy installed-runner verification.

First read:

1. `20_Deploy-To-Windows/2026-06-02-windows-v1041-postdeploy-verify/WINDOWS_HANDOFF_20260602_v1041_postdeploy_verify.md`
2. If needed for source context, `20_Deploy-To-Mac/2026-06-02-queued-to-ui-fix/MAC_HANDOFF_20260602_queued_to_ui_fix.md`

Important operating rules:

- Copy any needed files out of Syncthing into a local Windows work folder.
- Do not build or execute inside the shared folder.
- Keep secrets, passwords, cookies, tokens, passphrases, signed URLs, and raw provider keys out of Syncthing.
- Do not run paid AI, Apify, YouTube Data API, Naver save/edit/publish/schedule, customer credentials, or duplicate paid retries.
- Use no-paid verification only.

Tasks:

1. Confirm public API behavior from Windows:
   - `https://api.aimax.ai.kr/api/version?current=v1.0.40&platform=windows`
   - `https://api.aimax.ai.kr/api/version?current=v1.0.41&platform=windows`
   Expected: v1.0.40 requires update to v1.0.41, v1.0.41 does not require update.
2. Verify the deployed installer SHA256:
   - Expected: `712d3ed8ff445aab09e1fdb1fa24edbcaa4fba91131fb68b60c11c0dc49ce971`
3. Install or run v1.0.41 through the installed-user path.
4. Open the real web UI and confirm the installed runner heartbeat reports:
   - `connected=true`
   - `version=v1.0.41`
   - `update_required=false`
5. If a no-paid fake/local job path is available, run it and confirm queued_to_ui no longer stalls. Expected stage progression includes `claimed -> queued_to_ui -> ui_received -> worker_start_requested` or later.
6. Confirm the update popup does not block the runner after startup.

Return a Markdown report in:

`20_Deploy-To-Windows/2026-06-02-windows-v1041-postdeploy-verify/WINDOWS_RESULT_20260602_v1041_postdeploy_verify.md`

Include overall PASS/BLOCKED, Windows/browser versions, installed app version, public version API evidence, installer SHA256, heartbeat evidence, queued_to_ui/no-paid smoke result if available, blockers/error IDs, and an explicit no-paid/no-secrets statement.
