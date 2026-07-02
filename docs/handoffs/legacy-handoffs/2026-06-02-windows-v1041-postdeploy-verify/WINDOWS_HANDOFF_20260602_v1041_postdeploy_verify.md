# Windows Handoff - v1.0.41 Post-Deploy Verification

Date: 2026-06-02 KST
From: Mac/Oracle developer
To: Windows AI developer

## Context

Windows provided v1.0.41 for the queued_to_ui delay fix:

- Source folder: `20_Deploy-To-Mac/2026-06-02-queued-to-ui-fix/`
- Artifact: `aimax-bundle-windows-v1.0.41.exe`
- SHA256: `712d3ed8ff445aab09e1fdb1fa24edbcaa4fba91131fb68b60c11c0dc49ce971`

Mac/Oracle side completed:

- Uploaded v1.0.41 to Oracle download path: `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
- Remote SHA256 verified: `712d3ed8ff445aab09e1fdb1fa24edbcaa4fba91131fb68b60c11c0dc49ce971`
- Updated Oracle version API:
  - `AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.41`
  - `AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.41`
- Release notes:
  - `Windows 실행기 v1.0.41 업데이트입니다. 웹앱 작업 처리 지연(queued_to_ui)을 수정하고 업데이트 팝업 중 작업 지연을 방지했습니다.`
- Public API verification:
  - `current=v1.0.40&platform=windows` returns `latest_version=v1.0.41`, `min_version=v1.0.41`, `update_required=true`
  - `current=v1.0.41&platform=windows` returns `update_required=false`, `update_available=false`
- Yeri safe test mode remains disabled:
  - `AIMAX_YERI_SERVER_GENERATION_REAL_TEST_ONLY=0`

## Required Windows Verification

Please verify the real installed-user path on Windows after the Oracle rollout.

1. Copy any needed files out of Syncthing into a local Windows work folder. Do not build or execute inside the shared folder.
2. Confirm public version API behavior from Windows:
   - `https://api.aimax.ai.kr/api/version?current=v1.0.40&platform=windows`
   - `https://api.aimax.ai.kr/api/version?current=v1.0.41&platform=windows`
3. Download or use the deployed v1.0.41 installer and verify its SHA256:
   - Expected: `712d3ed8ff445aab09e1fdb1fa24edbcaa4fba91131fb68b60c11c0dc49ce971`
4. Install or run the v1.0.41 Windows runner as an installed-user flow.
5. Open the real web UI and confirm the installed runner heartbeat reports:
   - `connected=true`
   - `version=v1.0.41`
   - `update_required=false`
6. If a no-paid fake/local job path is available, run a no-paid smoke to confirm queued_to_ui no longer stalls:
   - Expected stage progression includes `claimed -> queued_to_ui -> ui_received -> worker_start_requested` or later.
   - Do not run paid AI, Apify, YouTube Data API, Naver save/edit/publish/schedule, or customer credentials.
7. Confirm the update popup does not block the runner after startup.

## Return Expectations

Return a Markdown result file to this same folder:

- Suggested name: `WINDOWS_RESULT_20260602_v1041_postdeploy_verify.md`
- Include:
  - Overall PASS/BLOCKED
  - Windows version and browser version
  - Installed app version
  - Public version API outputs or summarized fields
  - Installer SHA256
  - Heartbeat evidence
  - queued_to_ui/no-paid smoke result if available
  - Any blocker/error report IDs
  - Explicit statement that no paid AI, Apify, YouTube Data API, Naver save/edit/publish/schedule, customer credentials, or duplicate paid retry were used

Keep secrets, passwords, cookies, tokens, passphrases, signed URLs, and raw provider keys out of Syncthing.
