# Windows Pre-Deploy Installed Runner Check - v1.0.40

Date: 2026-06-02 KST
From: Mac/Oracle Codex
To: Windows AI developer

## Why this check is needed

The v1.0.40 Windows runner artifact is built, but the result report says the generated AIMAX installer was not executed.

Before Oracle upload/version API rollout, AIMAX release rules require at least one target-platform installed-runner user-path check. Source-mode smoke, inline fake smoke, PyInstaller success, and Inno build success are good, but they do not replace this gate.

Do not upload to Oracle or update version API from Windows.

## Artifact to test

Use the already-built installer in this Shared-Bridge folder:

- `aimax-bundle-windows-v1.0.40.exe`
- Expected size: `35,677,124` bytes
- Expected SHA256: `FE4E51537F8DF34876B896D8CDBB12FF64C91F60F7CCCE739F4D698B64214427`

## Constraints

- No paid AI generation.
- No Apify.
- No YouTube Data API.
- No Naver publish/schedule/edit/save.
- No customer credentials.
- No duplicate paid retry.
- Keep secrets/passphrases/cookies/keychains/session files out of Syncthing.

## Required installed-runner checks

1. Copy `aimax-bundle-windows-v1.0.40.exe` out of Syncthing to a local Windows folder.
2. Verify SHA256 before running.
3. Run the installer.
4. Launch/connect the installed AIMAX runner.
5. Confirm the installed runner reports `v1.0.40` in the app or logs.
6. Connect to the production web app using the approved test account/session.
7. Confirm the web UI sees the Windows runner as connected and version `v1.0.40`.
8. Exercise a safe no-paid/fake/local job path if available and confirm stages include:
   - `claimed`
   - `queued_to_ui`
   - `worker_thread_started`
   - `worker_running`
9. If a fake/local job path is not exposed in the installed app, report that clearly and still capture:
   - installed version
   - web connected status
   - update/version notice state
   - any runner logs showing startup/connect readiness

Do not run a real Yeri content generation job unless the owner explicitly approves provider, model, action, max cost, account, input size, output target, and retry/resume rule.

## Return file

Write back to this Shared-Bridge folder:

- `WINDOWS_PREDEPLOY_RESULT_20260602_v1040_installed_runner.md`

Include:

- Windows OS
- installer SHA256/size
- install result
- installed app version evidence
- web UI connected/version evidence
- screenshots or visible text evidence
- no-paid stage sequence evidence if available
- blocker notes if any

Once this passes, Mac/Oracle can upload the installer, update Windows version API to `v1.0.40`, deploy the small diagnostics sanitizer change if still missing, and then request/perform post-deploy verification.
